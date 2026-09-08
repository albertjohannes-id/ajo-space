import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { exec, within, type AppEntry } from "./core.js";
import fs from "node:fs/promises";
export type Runtime = {
  status: string;
  pid?: number;
  started?: number;
  logs: string;
  url?: string;
  port?: number;
  command?: string;
  cwd?: string;
  portConflict?: string;
};
async function listenerCwds(port: number): Promise<string[]> {
  try {
    const result = await exec(
      "/usr/sbin/lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"],
      { timeout: 2000 },
    );
    const pids = [
      ...new Set(
        result.stdout
          .split("\n")
          .filter((l) => /^p\d+$/.test(l))
          .map((l) => l.slice(1)),
      ),
    ];
    const directories = await Promise.all(
      pids.map(async (pid) => {
        try {
          const cwd = await exec(
            "/usr/sbin/lsof",
            ["-a", "-p", pid, "-d", "cwd", "-Fn"],
            { timeout: 2000 },
          );
          return (
            cwd.stdout
              .split("\n")
              .find((l) => l.startsWith("n"))
              ?.slice(1) || ""
          );
        } catch {
          return "";
        }
      }),
    );
    return directories.filter(Boolean);
  } catch {
    return [];
  }
}
// A listening default port is not proof that every app using it is running.
export async function identifyExternalOwner(
  apps: AppEntry[],
  port: number,
  directories: string[],
) {
  const candidates = await Promise.all(
    apps
      .filter((a) => a.port === port)
      .map(async (a) => ({
        a,
        cwd: await fs.realpath(a.cwd).catch(() => a.cwd),
      })),
  );
  const matches = candidates.filter(({ cwd }) =>
    directories.some((dir) => within(dir, cwd)),
  );
  matches.sort((a, b) => b.cwd.length - a.cwd.length);
  return matches.length &&
    (matches.length === 1 || matches[0].cwd.length > matches[1].cwd.length)
    ? matches[0].a.id
    : undefined;
}
export const portActive = (port: number) =>
  new Promise<boolean>((resolve) => {
    if (!port) return resolve(false);
    const s = net.connect({ port, host: "127.0.0.1" });
    s.setTimeout(400);
    const done = (v: boolean) => {
      s.destroy();
      resolve(v);
    };
    s.on("connect", () => done(true));
    s.on("error", () => done(false));
    s.on("timeout", () => done(false));
  });
export class Runner {
  states = new Map<string, Runtime>();
  children = new Map<string, ChildProcess>();
  async refresh(apps: AppEntry[]) {
    const ports = new Map<number, { active: boolean; owner?: string }>();
    for (const app of apps) {
      const port = this.children.has(app.id)
        ? this.states.get(app.id)?.port || app.port
        : app.port;
      if (!port || ports.has(port)) continue;
      const active = await portActive(port);
      const managed = apps.find(
        (a) =>
          this.children.has(a.id) &&
          (this.states.get(a.id)?.port || a.port) === port,
      );
      const owner =
        managed?.id ||
        (active
          ? await identifyExternalOwner(apps, port, await listenerCwds(port))
          : undefined);
      ports.set(port, { active, owner });
    }
    for (const app of apps) {
      let s = this.states.get(app.id);
      const port = this.children.has(app.id) ? s?.port || app.port : app.port;
      const { active = false, owner } = ports.get(port) || {};
      if (this.children.has(app.id)) {
        if (s && active) s.status = "Ready";
        else if (s && s.port && s.status === "Ready") s.status = "Starting";
        else if (s && !s.port && s.started && Date.now() - s.started > 1500)
          s.status = "Ready";
      } else if (active && owner === app.id) {
        s = {
          ...s,
          logs: s?.logs || "",
          status: "Running Externally",
          url: app.url,
          port: app.port,
        };
        this.states.set(app.id, s);
      } else {
        if (s?.status === "Running Externally") {
          s.status = "Stopped";
          s.pid = undefined;
        }
        if (!s) {
          s = { status: "Stopped", logs: "" };
          this.states.set(app.id, s);
        }
        s.portConflict = active
          ? `Port ${port} is used by ${apps.find((a) => a.id === owner)?.name || "another process"}.`
          : undefined;
      }
    }
    return Object.fromEntries(this.states);
  }
  async start(app: AppEntry) {
    if (this.children.has(app.id)) return;
    if (!app.command.trim()) throw Error("Set a run command first.");
    if (await portActive(app.port))
      throw Error(
        `Port ${app.port} is already in use. This process is external and will not be stopped.`,
      );
    const s: Runtime = {
      status: "Starting",
      started: Date.now(),
      logs: "",
      url: app.url,
      port: app.port,
      command: app.command,
      cwd: app.cwd,
    };
    this.states.set(app.id, s);
    const child = spawn(
      process.env.SHELL || "/bin/zsh",
      ["-l", "-c", app.command],
      {
        cwd: app.cwd,
        detached: true,
        env: {
          ...process.env,
          ...(app.port ? { PORT: String(app.port) } : {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.children.set(app.id, child);
    s.pid = child.pid;
    const log = (data: Buffer) => {
      const clean = data.toString().replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
      s.logs = (s.logs + clean).slice(-100000);
      const found = clean.match(
        /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+[^\s]*/,
      );
      if (found) {
        try {
          const u = new URL(found[0]);
          u.hostname = "localhost";
          s.url = u.toString();
          s.port = Number(u.port);
        } catch {}
      }
    };
    child.stdout?.on("data", log);
    child.stderr?.on("data", log);
    child.on("error", (e) => {
      s.logs += `\n${e.message}`;
      s.status = "Error";
      this.children.delete(app.id);
    });
    child.on("exit", (code) => {
      s.logs += `\n[Process exited${code === null ? "" : ` with code ${code}`}]\n`;
      s.status = code && code !== 0 ? "Error" : "Stopped";
      s.pid = undefined;
      this.children.delete(app.id);
    });
  }
  async stop(id: string) {
    const child = this.children.get(id);
    if (!child?.pid) return;
    const pid = child.pid;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
    this.children.delete(id);
    const s = this.states.get(id);
    if (s) {
      s.status = "Stopped";
      s.pid = undefined;
    }
  }
  async stopAll() {
    await Promise.all([...this.children.keys()].map((id) => this.stop(id)));
  }
}
