import { BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppEntry } from "./core.js";
export const localURL = (value: string) => {
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
    throw Error("Use a localhost URL.");
  return u.toString();
};
export const previewPath = (a: AppEntry) =>
  path.join(a.git?.root || a.path, ".ajo-space", "previews", a.id + ".png");
export class Previews {
  versions: Record<string, number> = {};
  errors: Record<string, string> = {};
  private pending = new Map<string, Promise<string>>();
  private attempts = new Map<
    string,
    { key: string; count: number; next: number }
  >();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private data: string) {}
  async read(a: AppEntry) {
    for (const p of [
      previewPath(a),
      path.join(this.data, "previews", a.id + ".png"),
    ]) {
      try {
        return (
          "data:image/png;base64," + (await fs.readFile(p)).toString("base64")
        );
      } catch {}
    }
    return null;
  }
  auto(a: AppEntry, state: any) {
    if (
      !["Ready", "Running Externally"].includes(state?.status) ||
      !(state.url || a.url)
    )
      return;
    const key = `${state.started || ""}:${state.pid || ""}:${state.url || a.url}`;
    const previous = this.attempts.get(a.id);
    if (
      previous?.key === key &&
      (previous.count >= 3 || Date.now() < previous.next)
    )
      return;
    const attempt = {
      key,
      count: previous?.key === key ? previous.count + 1 : 1,
      next: Infinity,
    };
    this.attempts.set(a.id, attempt);
    void this.capture(a, state.url || a.url).catch(() => {
      attempt.next = Date.now() + 30000;
    });
  }
  capture(a: AppEntry, url: string): Promise<string> {
    const existing = this.pending.get(a.id);
    if (existing) return existing;
    const work = this.queue.catch(() => {}).then(() => this.perform(a, url));
    this.queue = work;
    this.pending.set(a.id, work);
    void work.finally(() => this.pending.delete(a.id)).catch(() => {});
    return work;
  }
  private async perform(a: AppEntry, url: string) {
    const target = localURL(url);
    const window = new BrowserWindow({
      show: false,
      width: 1440,
      height: 900,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        partition: `preview-${a.id}`,
      },
    });
    const timeout = setTimeout(() => window.destroy(), 20000);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
      cb(false),
    );
    const guard = (e: Electron.Event, next: string) => {
      try {
        localURL(next);
      } catch {
        e.preventDefault();
      }
    };
    window.webContents.on("will-navigate", guard);
    window.webContents.on("will-redirect", guard);
    try {
      await window.loadURL(target);
      await new Promise((r) => setTimeout(r, 1800));
      const image = await window.webContents.capturePage();
      if (image.isEmpty()) throw Error("The app returned an empty preview.");
      const png = image.toPNG();
      const destination = previewPath(a);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination + ".tmp", png);
      await fs.rename(destination + ".tmp", destination);
      await fs.writeFile(
        destination.replace(/\.png$/, ".json"),
        JSON.stringify(
          {
            appPath: a.path,
            url: target,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      await fs.mkdir(path.join(this.data, "previews"), { recursive: true });
      await fs.writeFile(path.join(this.data, "previews", a.id + ".png"), png);
      this.versions[a.id] = Date.now();
      delete this.errors[a.id];
      return image.toDataURL();
    } catch (e) {
      this.errors[a.id] = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      clearTimeout(timeout);
      if (!window.isDestroyed()) window.destroy();
    }
  }
}
