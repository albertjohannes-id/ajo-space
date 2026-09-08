import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
export const exec = promisify(execFile);
export type Override = {
  name?: string;
  command?: string;
  cwd?: string;
  port?: number;
  url?: string;
  hidden?: boolean;
  notApp?: boolean;
  manual?: boolean;
  favorite?: boolean;
};
export type Settings = {
  spaceName?: string;
  avatar?: string;
  onboardingComplete?: boolean;
  roots: string[];
  excluded: string[];
  depth: number;
  autoScan: boolean;
  appearance: string;
  editor: string;
  overrides: Record<string, Override>;
};
export type AppEntry = {
  id: string;
  path: string;
  name: string;
  parent: string;
  hierarchy: string;
  type: string;
  command: string;
  cwd: string;
  port: number;
  url: string;
  favorite?: boolean;
  git?: any;
  preview?: string;
};
export const idFor = (p: string) =>
  createHash("sha256").update(path.resolve(p)).digest("hex").slice(0, 24);
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  ".cache",
  ".turbo",
  "target",
  ".expo",
  ".idea",
]);
export const within = (p: string, root: string) =>
  p === root || p.startsWith(root + path.sep);
async function read(p: string) {
  return fs.readFile(p, "utf8").catch(() => "");
}
const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
async function pythonCommand(dir: string) {
  for (const environment of [".venv", "venv"]) {
    for (const binary of ["python", "python3"]) {
      const executable = path.join(dir, environment, "bin", binary);
      if (
        await fs.access(executable, constants.X_OK).then(
          () => true,
          () => false,
        )
      )
        return shellQuote(executable);
    }
  }
  return "python3";
}
export async function detect(
  dir: string,
  names: string[],
): Promise<Partial<AppEntry> | null> {
  const has = (s: string) => names.includes(s);
  let type = "",
    command = "",
    port = 0;
  if (has("package.json")) {
    try {
      const pkg = JSON.parse(await read(path.join(dir, "package.json")));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const scripts = pkg.scripts || {};
      const script = scripts.dev
        ? "dev"
        : scripts.start
          ? "start"
          : scripts.serve
            ? "serve"
            : "";
      if (script) {
        const manager = has("pnpm-lock.yaml")
          ? "pnpm"
          : has("yarn.lock")
            ? "yarn"
            : has("bun.lock") || has("bun.lockb")
              ? "bun"
              : "npm";
        command = `${manager} run ${script}`;
        type = deps.next
          ? "Next.js"
          : deps.vite
            ? "Vite"
            : deps.expo
              ? "Expo"
              : deps.react
                ? "React"
                : deps.electron
                  ? "Electron"
                  : "Node.js";
        const match = scripts[script].match(/(?:--port[= ]|PORT=|-p\s+)(\d+)/);
        port = match
          ? Number(match[1])
          : deps.next
            ? 3000
            : deps.vite
              ? 5173
              : deps.expo
                ? 8081
                : 0;
      }
    } catch {}
  }
  if (!command && has("manage.py")) {
    type = "Django";
    command = `${await pythonCommand(dir)} manage.py runserver`;
    port = 8000;
  }
  if (!command && (has("requirements.txt") || has("pyproject.toml"))) {
    const python = await pythonCommand(dir);
    // Inspect source, never import project code during discovery. Prefer a web
    // entry point to a batch CLI when the same project provides both.
    for (const file of [
      "app.py",
      "main.py",
      "server.py",
      "web/app.py",
      "web/main.py",
      "app/main.py",
      "api/main.py",
      "backend/main.py",
    ]) {
      const code = await read(path.join(dir, file));
      const instance = code.match(
        /^([A-Za-z_]\w*)\s*(?::\s*FastAPI\s*)?=\s*FastAPI\s*\(/m,
      );
      if (/^from\s+fastapi\s+import\s+.*\bFastAPI\b/m.test(code) && instance) {
        type = "FastAPI";
        command = `${python} -m uvicorn ${file.replace(/\.py$/, "").replaceAll("/", ".")}:${instance[1]} --host 127.0.0.1 --port 8000`;
        port = 8000;
        break;
      }
    }
    const entry = ["app.py", "main.py", "server.py"].find(has);
    if (!command && entry) {
      type = "Python";
      command = `${python} ${entry}`;
      const code = await read(path.join(dir, entry));
      if (code.includes("Flask")) port = 5000;
    }
  }
  if (!command && has("go.mod")) {
    const files = names.filter((n) => n.endsWith(".go"));
    for (const f of files) {
      if (/package main/.test(await read(path.join(dir, f)))) {
        type = "Go";
        command = "go run .";
        break;
      }
    }
  }
  if (!command && has("Cargo.toml")) {
    const cargo = await read(path.join(dir, "Cargo.toml"));
    if (
      /\[\[bin\]\]/.test(cargo) ||
      (await fs.access(path.join(dir, "src/main.rs")).then(
        () => true,
        () => false,
      ))
    ) {
      type = "Rust";
      command = "cargo run";
    }
  }
  if (
    !command &&
    (has("docker-compose.yml") ||
      has("compose.yml") ||
      has("docker-compose.yaml") ||
      has("compose.yaml"))
  ) {
    type = "Docker";
    command = "docker compose up";
  }
  if (
    !command &&
    has("index.html") &&
    (names.some((n) => /\.(js|css)$/.test(n)) ||
      /<script|stylesheet/i.test(await read(path.join(dir, "index.html"))))
  ) {
    type = "Static";
    command = "python3 -m http.server 8080 --bind 127.0.0.1";
    port = 8080;
  }
  return command
    ? { type, command, port, url: port ? `http://localhost:${port}` : "" }
    : null;
}
export async function gitInfo(dir: string) {
  const g = async (...args: string[]) => {
    try {
      return (
        await exec("git", ["-C", dir, ...args], {
          timeout: 4000,
          maxBuffer: 1024 * 1024,
        })
      ).stdout.trim();
    } catch {
      return "";
    }
  };
  const root = await g("rev-parse", "--show-toplevel");
  if (!root) return undefined;
  const [branch, status, last, remote, name, email, ab, committed] =
    await Promise.all([
      g("branch", "--show-current"),
      exec(
        "git",
        [
          "-C",
          root,
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
          "--",
          ".",
          ":(exclude).ajo-space",
          ":(glob,exclude)**/.ajo-space/**",
        ],
        {
          timeout: 4000,
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        },
      ).then(
        (r) => r.stdout,
        () => "",
      ),
      g("log", "-1", "--pretty=%s"),
      g("remote", "get-url", "origin"),
      g("config", "user.name"),
      g("config", "user.email"),
      g("rev-list", "--left-right", "--count", "HEAD...@{upstream}"),
      g("log", "-1", "--format=%ct"),
    ]);
  const records = status.split("\0");
  const lines: string[] = [];
  const changedPaths: string[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    lines.push(record);
    changedPaths.push(record.slice(3));
    if (/[RC]/.test(record.slice(0, 2))) i++; // porcelain -z includes the old name separately
  }
  const committedAt = Number(committed) * 1000 || 0;
  const times = await Promise.all(
    changedPaths.map(async (file) => {
      const target = path.join(root, file);
      // Deleted files have no mtime: use the containing directory as an estimate.
      return fs.lstat(target).then(
        (s) => s.mtimeMs,
        () =>
          fs.stat(path.dirname(target)).then(
            (s) => s.mtimeMs,
            () => 0,
          ),
      );
    }),
  );
  const changedAt =
    times.reduce((latest, time) => Math.max(latest, time), 0) || committedAt;
  const [ahead, behind] = ab.split(/\s+/).map(Number);
  return {
    root,
    branch: branch || "Detached HEAD",
    dirty: lines.length > 0,
    changedAt,
    committedAt,
    modified: lines.filter((l) => !l.startsWith("??")).length,
    untracked: lines.filter((l) => l.startsWith("??")).length,
    last,
    remote,
    name,
    email,
    ahead: ahead || 0,
    behind: behind || 0,
  };
}
export async function scan(settings: Settings) {
  const apps: AppEntry[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const gitCache = new Map<string, any>();
  async function visit(dir: string, root: string, depth: number) {
    if (
      depth > settings.depth ||
      seen.has(dir) ||
      settings.excluded.some((e) => within(dir, e))
    )
      return;
    seen.add(dir);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      warnings.push(`Cannot read ${dir}`);
      return;
    }
    const o = settings.overrides[dir] || {};
    const detected = await detect(
      dir,
      entries.map((e) => e.name),
    );
    if ((detected || o.manual) && !o.notApp && !o.hidden) {
      const relative = path.relative(root, dir).split(path.sep);
      const gitRoot = await exec(
        "git",
        ["-C", dir, "rev-parse", "--show-toplevel"],
        { timeout: 3000 },
      ).then(
        (r) => r.stdout.trim(),
        () => "",
      );
      if (gitRoot && !gitCache.has(gitRoot))
        gitCache.set(gitRoot, await gitInfo(dir));
      apps.push({
        id: idFor(dir),
        path: dir,
        name: path.basename(dir).replace(/[-_]/g, " "),
        parent: relative.length > 1 ? path.basename(path.dirname(dir)) : "",
        hierarchy:
          relative.length > 1
            ? relative.slice(0, -2).join("/") || path.basename(root)
            : path.basename(root),
        type: "Manual",
        command: "",
        cwd: dir,
        port: 0,
        url: "",
        ...detected,
        ...o,
        git: gitCache.get(gitRoot),
      });
    }
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !ignored.has(entry.name) &&
        !entry.name.startsWith(".")
      )
        await visit(path.join(dir, entry.name), root, depth + 1);
    }
  }
  for (const root of settings.roots)
    await visit(path.resolve(root), path.resolve(root), 0);
  for (const [dir, o] of Object.entries(settings.overrides))
    if (o.manual && !seen.has(dir)) await visit(dir, path.dirname(dir), 0);
  return { apps: apps.sort((a, b) => a.name.localeCompare(b.name)), warnings };
}
