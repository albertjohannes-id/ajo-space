import { _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import net from "node:net";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-desktop-"));
const root = path.join(temporary, "Repository");
const fixture = path.join(root, "project/cases/store/prototype");
await fs.mkdir(fixture, { recursive: true });
const server = net.createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
await fs.writeFile(
  path.join(fixture, "package.json"),
  JSON.stringify({ scripts: { dev: `node server.cjs --port ${port}` } }),
);
await fs.writeFile(
  path.join(fixture, "server.cjs"),
  `require('http').createServer((q,s)=>{s.setHeader('Content-Type','text/html');s.end('<html><body style="background:#bada55;padding:80px;font:40px sans-serif"><h1>Preview fixture</h1><p>Ajo Space is running this app.</p></body></html>')}).listen(${port},'127.0.0.1',()=>console.log('http://localhost:${port}'));`,
);
const profile = path.join(temporary, "profile");
await fs.mkdir(profile);
await fs.writeFile(
  path.join(profile, "settings.json"),
  JSON.stringify({ roots: [root], autoScan: true }),
);
const desktop = await electron.launch({
  args: ["."],
  env: { ...process.env, AJO_SPACE_DATA_DIR: profile },
});
const page = await desktop.firstWindow();
let issues = [];
page.on("pageerror", (e) => issues.push(e.message));
try {
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Space name", { exact: true }).fill("Orbit Lab");
  await page.getByLabel("Badge (optional)", { exact: true }).fill("🚀");
  await page
    .getByRole("button", { name: "Create my space", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.locator(".brand .space-name").textContent(),
    "Orbit Lab",
  );
  const saved = JSON.parse(
    await fs.readFile(path.join(profile, "settings.json"), "utf8"),
  );
  assert.equal(saved.spaceName, "Orbit Lab");
  assert.equal(saved.onboardingComplete, true);
  await page
    .getByRole("heading", { name: "prototype", exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("heading", { name: "prototype", exact: true }).click();
  await page.getByRole("button", { name: "Run app", exact: true }).click();
  await page
    .locator(".detail-hero .status")
    .filter({ hasText: "Ready" })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await fetch(`http://localhost:${port}`).then((r) => r.status),
    200,
  );
  await page.getByRole("button", { name: "Refresh preview" }).click();
  await page.locator(".preview.large img").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page
    .locator(".detail-hero .status")
    .filter({ hasText: "Ready" })
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .locator(".detail-hero .status")
    .filter({ hasText: "Stopped" })
    .waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("App name").fill("Fixture storefront");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await page.getByRole("heading", { name: "Fixture storefront" }).waitFor();
  await page.getByRole("button", { name: "Back to library" }).click();
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/desktop-smoke.png" });
  assert.deepEqual(issues, []);
  console.log(
    "Desktop smoke passed: discovery, run, readiness, preview, restart, stop, rename, renderer errors.",
  );
} finally {
  await desktop.close();
  await fs.rm(temporary, { recursive: true, force: true });
}
