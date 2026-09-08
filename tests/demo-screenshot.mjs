// Documentation image generator: only synthetic fixtures in an isolated profile.
import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "ajo-public-demo-"));
const root = path.join(temporary, "Repository");
const profile = path.join(temporary, "profile");
await fs.mkdir(root);
await fs.mkdir(profile);
const socket = net.createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const projects = [
  ["atlas-web", "next"],
  ["field-notes", "vite"],
  ["launchpad", "expo"],
  ["orbit-api", "fastapi"],
  ["palette-studio", "react"],
  ["signal-desktop", "electron"],
];
for (const [name, type] of projects) {
  const folder = path.join(root, name);
  await fs.mkdir(folder);
  if (type === "fastapi") {
    await fs.writeFile(
      path.join(folder, "requirements.txt"),
      "fastapi\nuvicorn",
    );
    await fs.writeFile(
      path.join(folder, "app.py"),
      "from fastapi import FastAPI\napp = FastAPI()",
    );
  } else {
    await fs.writeFile(
      path.join(folder, "package.json"),
      JSON.stringify({
        scripts: {
          dev:
            name === "atlas-web"
              ? `node server.cjs --port ${port}`
              : 'echo "Demo fixture"',
        },
        dependencies: { [type]: "*" },
      }),
    );
  }
}
await fs.writeFile(
  path.join(root, "atlas-web/server.cjs"),
  `require('http').createServer((q,s)=>{s.setHeader('Content-Type','text/html');s.end('<html><body style="margin:0;background:#e7eee5;color:#24362b;font-family:system-ui;padding:50px"><nav style="font-weight:700">ATLAS <span style="float:right;font-weight:400">Explore &nbsp; Journal &nbsp; About</span></nav><main style="margin-top:70px"><small>LESS NOISE. MORE POSSIBILITY.</small><h1 style="font-size:76px;letter-spacing:-4px;line-height:1;margin:30px 0">Find your<br>next horizon.</h1><p style="font-size:22px;color:#637464">A little room for your next big idea.</p><div style="display:flex;gap:24px;margin-top:60px"><div style="width:32%;height:200px;background:#bdcea2;border-radius:100px 100px 14px 14px"></div><div style="width:32%;height:200px;background:#759382;border-radius:14px"></div><div style="width:32%;height:200px;background:#d4c6a5;border-radius:14px 100px 14px 14px"></div></div></main></body></html>');}).listen(${port},'127.0.0.1',()=>console.log('http://localhost:${port}'));`,
);
await fs.writeFile(
  path.join(profile, "settings.json"),
  JSON.stringify({
    roots: [root],
    autoScan: true,
    spaceName: "Ajo Space",
    avatar: "",
    onboardingComplete: true,
  }),
);
process.env.AJO_SPACE_DATA_DIR = profile;
process.argv.push("--run", path.join(root, "atlas-web"));
app.on("browser-window-created", (_event, window) => window.hide());
await import("../dist-electron/main.js");
app.on("will-quit", () => rmSync(temporary, { recursive: true, force: true }));
app.whenReady().then(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const captures = await fs
        .readdir(path.join(root, "atlas-web/.ajo-space/previews"))
        .catch(() => []);
      if (captures.some((p) => p.endsWith(".png"))) {
        ready = true;
        break;
      }
    }
    if (!ready) throw Error("Demo did not capture its synthetic preview");
    await new Promise((r) => setTimeout(r, 3000));
    const window = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith("file:"),
    );
    if (!window) throw Error("Demo window missing");
    window.setSize(1440, 1000);
    window.webContents.setZoomFactor(0.8);
    await new Promise((r) => setTimeout(r, 300));
    const image = await window.capturePage(undefined, { stayHidden: true });
    await fs.mkdir("docs/assets", { recursive: true });
    await fs.writeFile(
      "docs/assets/library.png",
      image.resize({ width: 1440 }).toPNG(),
    );
    console.log("Saved synthetic-only documentation screenshot.");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
