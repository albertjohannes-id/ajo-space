import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { scan, detect, idFor, exec, type Settings } from "../electron/core.js";
import { Runner } from "../electron/runtime.js";
const defaults: Settings = {
  roots: [],
  excluded: [],
  depth: 8,
  autoScan: true,
  appearance: "dark",
  editor: "Cursor",
  overrides: {},
};
test("nested discovery preserves hierarchy, skips generated directories, applies overrides and stable IDs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-scan-"));
  try {
    const dirs = [
      "productX/cases/007-store/prototype",
      "other/prototype",
      "node_modules/fake",
      "backend",
      "library",
    ];
    for (const d of dirs)
      await fs.mkdir(path.join(root, d), { recursive: true });
    for (const d of dirs.slice(0, 3))
      await fs.writeFile(
        path.join(root, d, "package.json"),
        JSON.stringify({
          scripts: { dev: "vite" },
          devDependencies: { vite: "*" },
        }),
      );
    await fs.writeFile(path.join(root, "library/package.json"), "{}");
    let result = await scan({ ...defaults, roots: [root] });
    assert.equal(result.apps.length, 2);
    const a = result.apps.find((a) => a.parent === "007-store")!;
    assert.ok(a);
    assert.equal(a.hierarchy, "productX/cases");
    assert.equal(new Set(result.apps.map((a) => a.id)).size, 2);
    assert.equal(a.id, idFor(a.path));
    result = await scan({
      ...defaults,
      roots: [root],
      overrides: {
        [a.path]: { notApp: true },
        [path.join(root, "backend")]: {
          manual: true,
          name: "Custom backend",
          command: "echo hi",
        },
      },
    });
    assert.equal(result.apps.length, 2);
    assert.ok(result.apps.some((a) => a.name === "Custom backend"));
    result = await scan({
      ...defaults,
      roots: [root],
      excluded: [path.join(root, "productX")],
    });
    assert.equal(result.apps.length, 1);
    result = await scan({ ...defaults, roots: [root], depth: 1 });
    assert.equal(result.apps.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("manifests alone do not imply a runnable app", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-detect-"));
  try {
    await fs.writeFile(path.join(root, "requirements.txt"), "requests");
    assert.equal(await detect(root, ["requirements.txt"]), null);
    await fs.writeFile(path.join(root, "Cargo.toml"), "[lib]");
    assert.equal(await detect(root, ["Cargo.toml"]), null);
    await fs.writeFile(
      path.join(root, "index.html"),
      '<script src="app.js"></script>',
    );
    assert.equal((await detect(root, ["index.html"]))?.type, "Static");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("git reports effective identity separately from remote and counts changes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-git-"));
  try {
    await exec("git", ["init", root]);
    await exec("git", ["-C", root, "config", "user.name", "Fixture User"]);
    await exec("git", [
      "-C",
      root,
      "config",
      "user.email",
      "fixture@example.test",
    ]);
    await exec("git", [
      "-C",
      root,
      "remote",
      "add",
      "origin",
      "https://github.com/company/project.git",
    ]);
    await fs.writeFile(
      path.join(root, "package.json"),
      '{"scripts":{"dev":"node server.js"}}',
    );
    await exec("git", ["-C", root, "add", "."]);
    await exec("git", ["-C", root, "commit", "-m", "Initial fixture"]);
    await fs.writeFile(
      path.join(root, "package.json"),
      '{"scripts":{"dev":"node app.js"}}',
    );
    await fs.writeFile(path.join(root, "new.txt"), "new");
    const { apps } = await scan({ ...defaults, roots: [root] });
    assert.equal(apps[0].git.name, "Fixture User");
    assert.equal(apps[0].git.modified, 1);
    assert.equal(apps[0].git.untracked, 1);
    assert.equal(apps[0].git.last, "Initial fixture");
    assert.match(apps[0].git.remote, /company/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("runner detects readiness, logs, stop, restart, and protects external processes", async () => {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as net.AddressInfo).port;
  const app: any = {
    id: "fixture",
    command: `'${process.execPath}' -e 'require("http").createServer((q,s)=>s.end("ok")).listen(${port},"127.0.0.1",()=>console.log("ready"))'`,
    cwd: process.cwd(),
    path: process.cwd(),
    port,
    url: `http://localhost:${port}`,
  };
  const runner = new Runner();
  try {
    const unrelated = {
      ...app,
      id: "unrelated",
      cwd: os.tmpdir(),
      path: os.tmpdir(),
    };
    await runner.refresh([app, unrelated]);
    assert.equal(runner.states.get(app.id)?.status, "Running Externally");
    assert.equal(runner.states.get(unrelated.id)?.status, "Stopped");
    assert.match(runner.states.get(unrelated.id)?.portConflict || "", /Port/);
    await assert.rejects(() => runner.start(app), /already in use/);
    await runner.stop(app.id);
    assert.ok(server.listening);
    await new Promise<void>((r) => server.close(() => r()));
    await runner.start(app);
    await new Promise((r) => setTimeout(r, 900));
    await runner.refresh([app]);
    assert.equal(runner.states.get(app.id)?.status, "Ready");
    await runner.refresh([app, unrelated]);
    assert.equal(runner.states.get(unrelated.id)?.status, "Stopped");
    assert.match(runner.states.get(app.id)!.logs, /ready/);
    assert.equal(await fetch(app.url).then((r) => r.text()), "ok");
    await runner.stop(app.id);
    assert.equal(runner.states.get(app.id)?.status, "Stopped");
    await runner.start(app);
    await new Promise((r) => setTimeout(r, 900));
    await runner.refresh([app]);
    assert.equal(runner.states.get(app.id)?.status, "Ready");
  } finally {
    server.close();
    await runner.stopAll();
  }
});

test("Python discovery uses a local virtualenv and prefers FastAPI over a batch CLI", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "ajo-python's project-"),
  );
  try {
    await fs.mkdir(path.join(root, ".venv/bin"), { recursive: true });
    await fs.symlink(process.execPath, path.join(root, ".venv/bin/python"));
    await fs.mkdir(path.join(root, "web"));
    await fs.writeFile(
      path.join(root, "requirements.txt"),
      "fastapi\nuvicorn\npdf2image",
    );
    await fs.writeFile(path.join(root, "main.py"), 'print("batch processing")');
    await fs.writeFile(
      path.join(root, "web/app.py"),
      'from fastapi import FastAPI\napp = FastAPI(title="Web UI")',
    );
    const names = ["requirements.txt", "main.py", "web", ".venv"];
    let found = await detect(root, names);
    assert.equal(found?.type, "FastAPI");
    assert.match(
      found!.command!,
      /-m uvicorn web\.app:app --host 127\.0\.0\.1 --port 8000$/,
    );
    assert.equal(found?.port, 8000);
    // Execute only the fixture interpreter (Node), confirming shell quoting for
    // spaces and apostrophes without importing or launching project code.
    const interpreter = found!.command!.split(" -m uvicorn")[0];
    assert.equal(
      (await exec("/bin/zsh", ["-c", `${interpreter} -p '1+1'`])).stdout.trim(),
      "2",
    );
    await fs.rm(path.join(root, "web/app.py"));
    found = await detect(root, names);
    assert.equal(found?.type, "Python");
    assert.match(found!.command!, /\.venv\/bin\/python' main\.py$/);
    await fs.rm(path.join(root, ".venv"), { recursive: true });
    assert.equal((await detect(root, names))?.command, "python3 main.py");
    await fs.mkdir(path.join(root, "venv/bin"), { recursive: true });
    await fs.symlink(process.execPath, path.join(root, "venv/bin/python"));
    assert.match(
      (await detect(root, [...names, "manage.py"]))!.command!,
      /venv\/bin\/python' manage.py runserver$/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("external process attribution rejects ambiguous working directories", async () => {
  const { identifyExternalOwner } = await import("../electron/runtime.ts");
  const root = process.cwd();
  const a: any = { id: "a", cwd: root, port: 8000 };
  assert.equal(
    await identifyExternalOwner([a, { ...a, id: "b" }], 8000, [root]),
    undefined,
  );
  assert.equal(
    await identifyExternalOwner(
      [a, { id: "nested", cwd: root + "/electron", port: 8000 }],
      8000,
      [root + "/electron"],
    ),
    "nested",
  );
});

test("Changed recency follows edits and ignores generated preview files", async () => {
  const { gitInfo } = await import("../electron/core.ts");
  const { newestChangedFirst } = await import("../src/library.ts");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-recency-"));
  try {
    await exec("git", ["init", root]);
    await fs.writeFile(path.join(root, "old file.txt"), "old");
    const old = new Date("2025-01-01T00:00:00Z");
    await fs.utimes(path.join(root, "old file.txt"), old, old);
    const first = await gitInfo(root);
    await fs.writeFile(path.join(root, "new\nfile.txt"), "new");
    const recent = new Date("2026-01-01T00:00:00Z");
    await fs.utimes(path.join(root, "new\nfile.txt"), recent, recent);
    await fs.mkdir(path.join(root, ".ajo-space/previews"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".ajo-space/previews/test.png"),
      "generated",
    );
    const second = await gitInfo(root);
    assert.equal(first?.changedAt, old.getTime());
    assert.equal(second?.changedAt, recent.getTime());
    assert.equal(second?.untracked, 2);
    const sorted = [
      { name: "A", path: "old", git: first },
      { name: "Z", path: "new", git: second },
    ].sort(newestChangedFirst);
    assert.equal(sorted[0].path, "new");
    await fs.rm(path.join(root, "old file.txt"));
    await fs.rm(path.join(root, "new\nfile.txt"));
    assert.equal((await gitInfo(root))?.dirty, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
