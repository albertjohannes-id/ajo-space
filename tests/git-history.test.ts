import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec } from "../electron/core.js";
import { gitHistory } from "../electron/git-history.js";
test("history shows full messages, paging, cached upstream and an actual local push event", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-history-"));
  const repo = path.join(root, "repo"),
    remote = path.join(root, "origin.git");
  const g = async (...args: string[]) => exec("git", ["-C", repo, ...args]);
  try {
    await exec("git", ["init", "-b", "main", repo]);
    await exec("git", ["init", "--bare", remote]);
    await g("config", "user.name", "History Tester");
    await g("config", "user.email", "test@example.invalid");
    await g("config", "core.hooksPath", "/dev/null");
    let h = await gitHistory(repo);
    assert.deepEqual(h.commits, []);
    assert.equal(h.lastPush, null);
    await g(
      "commit",
      "--allow-empty",
      "-m",
      "Initial subject",
      "-m",
      "Full comment body\nSecond line with <tags> and quotes.",
    );
    h = await gitHistory(repo);
    assert.equal(h.commits[0].author, "History Tester");
    assert.match(h.commits[0].body, /Second line with <tags>/);
    assert.equal(h.upstream, null);
    assert.equal(h.commits[0].localOnly, undefined);
    await g("remote", "add", "origin", remote);
    await g("push", "-u", "origin", "main");
    h = await gitHistory(repo);
    assert.equal(h.upstream, "origin/main");
    assert.ok(h.lastPush);
    assert.equal(h.lastPush.commit?.subject, "Initial subject");
    assert.ok(Number.isFinite(Date.parse(h.lastPush.at)));
    assert.equal(h.upstreamCommit?.hash, h.commits[0].hash);
    assert.equal(h.commits[0].localOnly, false);
    const pushed = h.lastPush.hash;
    for (let i = 1; i <= 21; i++)
      await g("commit", "--allow-empty", "-m", `Local change ${i}`);
    h = await gitHistory(repo);
    assert.equal(h.commits.length, 20);
    assert.equal(h.commits[0].subject, "Local change 21");
    assert.equal(h.commits[0].localOnly, true);
    assert.equal(h.hasMore, true);
    assert.equal(h.lastPush?.hash, pushed);
    const older = await gitHistory(repo, 20);
    assert.equal(older.commits.length, 2);
    assert.equal(older.hasMore, false);
    assert.equal(older.commits[1].subject, "Initial subject");
    await assert.rejects(() => gitHistory(repo, -1), /Invalid history offset/);
    await g("checkout", "--detach");
    assert.equal((await gitHistory(repo)).upstream, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
