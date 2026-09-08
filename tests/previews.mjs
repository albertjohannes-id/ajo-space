import { app } from "electron";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { Previews, previewPath } from "../dist-electron/previews.js";
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-preview-"));
  const server = http.createServer((_q, s) => {
    s.setHeader("Content-Type", "text/html");
    s.end(
      '<html><body style="background:#294239;color:white;padding:80px;font:40px sans-serif"><h1>Automatic preview</h1></body></html>',
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const a = {
      id: "nested-app",
      path: path.join(root, "web"),
      git: { root },
      url: `http://localhost:${server.address().port}`,
    };
    const previews = new Previews(path.join(root, "cache"));
    previews.auto(a, { status: "Stopped" });
    assert.equal(previews.versions[a.id], undefined);
    previews.auto(a, { status: "Ready", started: 1, url: a.url });
    for (let i = 0; i < 100 && !previews.versions[a.id]; i++)
      await new Promise((r) => setTimeout(r, 100));
    assert.ok(previews.versions[a.id], JSON.stringify(previews.errors));
    const png = await fs.readFile(previewPath(a));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.ok(
      previewPath(a).startsWith(path.join(root, ".ajo-space/previews")),
    );
    const saved = await new Previews(path.join(root, "cache")).read(a);
    assert.ok(saved.startsWith("data:image/png;base64,"));
    const version = previews.versions[a.id];
    previews.auto(a, { status: "Ready", started: 1, url: a.url });
    assert.equal(previews.versions[a.id], version);
    await previews.capture({ ...a, id: "second-nested-app" }, a.url);
    assert.ok(
      await fs.stat(
        path.join(root, ".ajo-space/previews/second-nested-app.png"),
      ),
    );
    await fs.mkdir("artifacts", { recursive: true });
    await fs.copyFile(previewPath(a), "artifacts/automatic-preview-test.png");
    console.log(
      "PASS automatic capture, repository persistence, reload, deduplication, separate nested-app previews.",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await new Promise((r) => server.close(r));
    await fs.rm(root, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  }
});
