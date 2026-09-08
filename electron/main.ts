import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  nativeTheme,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan, exec, gitInfo, type Settings, type AppEntry } from "./core.js";
import { validateProfile } from "./profile.js";
import { Runner } from "./runtime.js";
import { gitHistory } from "./git-history.js";
import { Previews, localURL, previewPath } from "./previews.js";
const here = path.dirname(fileURLToPath(import.meta.url));
app.setName("Ajo Space");
if (process.env.AJO_SPACE_DATA_DIR)
  app.setPath("userData", process.env.AJO_SPACE_DATA_DIR);
let win: BrowserWindow;
let apps: AppEntry[] = [];
let scanning = false;
const runner = new Runner();
let quitting = false;
let settings: Settings = {
  spaceName: "Ajo Space",
  avatar: "",
  onboardingComplete: false,
  roots: [],
  excluded: [],
  depth: 8,
  autoScan: true,
  appearance: "dark",
  editor: "Cursor",
  overrides: {},
};
const data = () => app.getPath("userData");
const save = async () => {
  await fs.mkdir(data(), { recursive: true });
  const p = path.join(data(), "settings.json");
  await fs.writeFile(p + ".tmp", JSON.stringify(settings, null, 2));
  await fs.rename(p + ".tmp", p);
};
let activeScan: Promise<Awaited<ReturnType<typeof scan>>> | undefined;
function doScan() {
  if (activeScan) return activeScan;
  scanning = true;
  activeScan = (async () => {
    try {
      const result = await scan(settings);
      apps = result.apps;
      await fs.writeFile(
        path.join(data(), "library.json"),
        JSON.stringify(apps),
      );
      return result;
    } finally {
      scanning = false;
      activeScan = undefined;
    }
  })();
  return activeScan;
}
let previews: Previews;
let nextGitRefresh = 0;
let refreshingGit = false;
async function refreshGit() {
  if (refreshingGit || scanning || Date.now() < nextGitRefresh) return;
  refreshingGit = true;
  nextGitRefresh = Date.now() + 30000;
  try {
    const roots = [
      ...new Set(apps.map((a) => a.git?.root).filter(Boolean)),
    ] as string[];
    for (const root of roots) {
      const info = await gitInfo(root);
      for (const a of apps) if (a.git?.root === root) a.git = info;
    }
  } finally {
    refreshingGit = false;
  }
}
function register() {
  ipcMain.handle("ajo", async (event, action: string, payload: any) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw Error("Invalid sender");
    const selected = () => {
      const a = apps.find((a) => a.id === payload?.id);
      if (!a) throw Error("App no longer exists. Rescan the library.");
      return a;
    };
    switch (action) {
      case "state": {
        void refreshGit().catch(() => {});
        const runtime = await runner.refresh(apps);
        for (const a of apps) previews.auto(a, runtime[a.id]);
        return {
          settings,
          apps,
          runtime,
          previewVersions: previews.versions,
          previewErrors: previews.errors,
          previewPaths: Object.fromEntries(
            apps.map((a) => [a.id, previewPath(a)]),
          ),
        };
      }
      case "gitHistory":
        return gitHistory(selected().path, payload.offset || 0);
      case "scan":
        return doScan();
      case "chooseRoot":
      case "manual":
      case "exclude": {
        if (action === "exclude" && runner.children.size)
          throw Error("Stop managed apps before excluding folders.");
        const result = await dialog.showOpenDialog(win, {
          properties: [
            "openDirectory",
            ...(action === "chooseRoot" ? ["multiSelections" as const] : []),
          ],
        });
        if (result.canceled) return null;
        for (const dir of result.filePaths) {
          if (action === "chooseRoot")
            settings.roots = [...new Set([...settings.roots, dir])];
          if (action === "exclude")
            settings.excluded = [...new Set([...settings.excluded, dir])];
          if (action === "manual")
            settings.overrides[dir] = {
              ...settings.overrides[dir],
              manual: true,
              notApp: false,
              hidden: false,
            };
        }
        await save();
        return doScan();
      }
      case "profile": {
        const profile = validateProfile(payload);
        settings = { ...settings, ...profile, onboardingComplete: true };
        await save();
        return settings;
      }
      case "settings": {
        if (
          runner.children.size &&
          (payload.roots || payload.excluded || payload.depth !== undefined)
        )
          throw Error(
            "Stop managed apps before changing scan folders or depth.",
          );
        if (
          payload.depth !== undefined &&
          (!Number.isInteger(payload.depth) ||
            payload.depth < 1 ||
            payload.depth > 20)
        )
          throw Error("Scan depth must be between 1 and 20.");
        for (const key of [
          "roots",
          "excluded",
          "depth",
          "autoScan",
          "appearance",
          "editor",
        ] as const)
          if (key in payload) (settings as any)[key] = payload[key];
        nativeTheme.themeSource = settings.appearance as
          "dark" | "light" | "system";
        await save();
        return settings;
      }
      case "override": {
        const a = selected();
        const o = payload.values;
        if ((o.hidden || o.notApp) && runner.children.has(a.id))
          throw Error("Stop this app before hiding or removing it.");
        if (
          o.port !== undefined &&
          (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535)
        )
          throw Error("Port must be between 0 and 65535.");
        if (o.url) localURL(o.url);
        if (o.cwd && !path.isAbsolute(o.cwd))
          throw Error("Working directory must be an absolute path.");
        settings.overrides[a.path] = { ...settings.overrides[a.path], ...o };
        await save();
        Object.assign(a, o);
        if (o.hidden || o.notApp) apps = apps.filter((x) => x.id !== a.id);
        await fs.writeFile(
          path.join(data(), "library.json"),
          JSON.stringify(apps),
        );
        return a;
      }
      case "restore":
        delete settings.overrides[payload.path];
        await save();
        return doScan();
      case "run":
        await runner.start(selected());
        return true;
      case "stop":
        await runner.stop(selected().id);
        return true;
      case "restart": {
        const a = selected();
        if (runner.states.get(a.id)?.status === "Running Externally")
          throw Error("External processes cannot be restarted.");
        await runner.stop(a.id);
        await runner.start(a);
        return true;
      }
      case "open": {
        const a = selected();
        await shell.openExternal(
          localURL(runner.states.get(a.id)?.url || a.url),
        );
        return true;
      }
      case "quick": {
        const a = selected();
        switch (payload.target) {
          case "path":
            clipboard.writeText(a.path);
            break;
          case "url":
            clipboard.writeText(runner.states.get(a.id)?.url || a.url);
            break;
          case "Finder":
            shell.showItemInFolder(a.path);
            break;
          case "Terminal":
            await exec("/usr/bin/open", ["-a", "Terminal", a.cwd]);
            break;
          case "editor":
          case "Cursor":
          case "Visual Studio Code":
            await exec("/usr/bin/open", [
              "-a",
              payload.target === "editor" ? settings.editor : payload.target,
              a.path,
            ]);
            break;
        }
        return true;
      }
      case "capture": {
        const a = selected();
        return previews.capture(a, runner.states.get(a.id)?.url || a.url);
      }
      case "preview":
        return previews.read(selected());
      default:
        throw Error("Unknown action");
    }
  });
}
app.whenReady().then(async () => {
  previews = new Previews(data());
  await fs.mkdir(data(), { recursive: true });
  try {
    settings = {
      ...settings,
      ...JSON.parse(
        await fs.readFile(path.join(data(), "settings.json"), "utf8"),
      ),
    };
  } catch {}
  try {
    apps = JSON.parse(
      await fs.readFile(path.join(data(), "library.json"), "utf8"),
    );
  } catch {}
  nativeTheme.themeSource = settings.appearance as "dark" | "light" | "system";
  register();
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1050,
    minHeight: 700,
    title: "Ajo Space",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#101112",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  await win.loadFile(path.join(here, "../dist/index.html"));
  // Explicit local launch request, useful when reopening the desktop app.
  const requestedIds = process.argv.flatMap((arg, index) =>
    arg === "--run" && process.argv[index + 1] ? [process.argv[index + 1]] : [],
  );
  if (requestedIds.length) {
    await doScan();
    for (const id of new Set(requestedIds)) {
      const requested = apps.find((a) => a.path === id || a.id === id);
      if (requested)
        await runner.start(requested).catch((e) => {
          runner.states.set(requested.id, { status: "Error", logs: String(e) });
        });
    }
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (e) => {
  if (!quitting && runner.children.size) {
    e.preventDefault();
    quitting = true;
    runner.stopAll().finally(() => app.quit());
  }
});

process.on("SIGTERM", () => app.quit());
