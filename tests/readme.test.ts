import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readReadme, README_LIMIT } from "../electron/readme.js";
test("README selection prefers app Markdown and falls back to the repository root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-readme-"));
  const appPath = path.join(root, "nested");
  await fs.mkdir(appPath);
  const app = { path: appPath, git: { root } };
  try {
    assert.equal(await readReadme(app), null);
    await fs.writeFile(path.join(root, "README.md"), "# Repository");
    let result = await readReadme(app);
    assert.equal(result?.repositoryFallback, true);
    assert.equal(result?.content, "# Repository");
    await fs.writeFile(path.join(appPath, "readme.MD"), "# Nested app");
    result = await readReadme(app);
    assert.equal(result?.repositoryFallback, false);
    assert.equal(result?.content, "# Nested app");
    await fs.writeFile(path.join(appPath, "readme.MD"), "");
    assert.equal((await readReadme(app))?.content, "");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("README reads are bounded and refuse symlinks outside the project", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-readme-bound-"));
  const appPath = path.join(root, "app");
  await fs.mkdir(appPath);
  try {
    const file = path.join(appPath, "README.md");
    await fs.writeFile(file, "😀".repeat(README_LIMIT));
    const result = await readReadme({ path: appPath });
    assert.equal(result?.truncated, true);
    assert.ok(Buffer.byteLength(result!.content) <= README_LIMIT);
    assert.ok(!result!.content.endsWith("�"));
    await fs.rm(file);
    await fs.writeFile(path.join(root, "outside.md"), "outside");
    await fs.symlink(path.join(root, "outside.md"), file);
    await assert.rejects(
      () => readReadme({ path: appPath }),
      /outside its project/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
