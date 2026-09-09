import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Plus,
  Star,
  Settings,
  Folder,
  GitBranch,
  ArrowUpRight,
  ChevronLeft,
  Camera,
  Terminal,
  Copy,
  Code,
  LayoutGrid,
  Activity,
  Command,
  RefreshCw,
  X,
} from "lucide-react";
import "./style.css";
import { SpaceProfile } from "./SpaceProfile";
import { spaceBadge } from "../electron/profile";
import { ReadmePanel } from "./ReadmePanel";
import { GitHistory } from "./GitHistory";
import { newestChangedFirst } from "./library";
import { FrameworkIcon } from "./FrameworkIcon";
declare global {
  interface Window {
    ajo: { call: (action: string, payload?: any) => Promise<any> };
  }
}
const api = (a: string, p?: any) => window.ajo.call(a, p);
const icons: any = {
  All: LayoutGrid,
  Running: Activity,
  Stopped: Square,
  Changed: GitBranch,
  Favorites: Star,
};
function App() {
  const [apps, setApps] = useState<any[]>([]),
    [settings, setSettings] = useState<any>({
      roots: [],
      excluded: [],
      overrides: {},
    }),
    [runtime, setRuntime] = useState<any>({}),
    [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState("library"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [previews, setPreviews] = useState<any>({}),
    [draft, setDraft] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const onboarding = settingsLoaded && !settings.onboardingComplete;
  const spaceName = settings.spaceName || "Ajo Space";
  const loadedPreviews = useRef<Record<string, number>>({});
  const [previewVersions, setPreviewVersions] = useState<
    Record<string, number>
  >({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>(
    {},
  );
  const [previewPaths, setPreviewPaths] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<any>) => {
    try {
      return await fn();
    } catch (e: any) {
      setError(
        e.message.replace(/^Error invoking remote method 'ajo': Error: /, ""),
      );
    }
  };
  const sync = async () => {
    const s = await api("state");
    setApps(s.apps);
    setSettings(s.settings);
    setSettingsLoaded(true);
    setRuntime(s.runtime);
    setPreviewVersions(s.previewVersions || {});
    setPreviewErrors(s.previewErrors || {});
    setPreviewPaths(s.previewPaths || {});
    return s;
  };
  const scan = async (action = "scan") => {
    setBusy(true);
    await run(async () => {
      const r = await api(action);
      await sync();
      if (r?.warnings?.length) setError(r.warnings.join("\n"));
    });
    setBusy(false);
  };
  useEffect(() => {
    run(async () => {
      const s = await sync();
      if (s.settings.autoScan && s.settings.onboardingComplete) await scan();
    });
    const t = setInterval(() => run(sync), 2500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    for (const a of apps)
      if (loadedPreviews.current[a.id] !== (previewVersions[a.id] || 0)) {
        loadedPreviews.current[a.id] = previewVersions[a.id] || 0;
        api("preview", { id: a.id })
          .then((p) => setPreviews((old: any) => ({ ...old, [a.id]: p })))
          .catch(() => {
            delete loadedPreviews.current[a.id];
          });
      }
  }, [apps, previewVersions]);
  const status = (a: any) => runtime[a.id]?.status || "Stopped";
  const running = (a: any) =>
    ["Ready", "Starting", "Running Externally"].includes(status(a));
  const action = async (a: any, act: string) =>
    run(async () => {
      await api(act, { id: a.id });
      await sync();
    });
  const override = async (a: any, values: any) =>
    run(async () => {
      await api("override", { id: a.id, values });
      await sync();
    });
  const a = apps.find((a) => a.id === selected);
  const r = a ? runtime[a.id] || {} : {};
  const visible = apps.filter(
    (a) =>
      (filter === "All" ||
        (filter === "Running" && running(a)) ||
        (filter === "Stopped" && !running(a)) ||
        (filter === "Changed" && a.git?.dirty) ||
        (filter === "Favorites" && a.favorite)) &&
      `${a.name} ${a.path} ${a.type}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (filter === "Changed") visible.sort(newestChangedFirst);
  const saveSettings = (values: any) =>
    run(async () => {
      await api("settings", values);
      await sync();
    });
  const preview = (a: any, large = false) => (
    <div
      className={`preview ${large ? "large" : ""} type-${a.type?.replace(/\W/g, "")}`}
      style={{ "--hue": parseInt(a.id.slice(0, 4), 16) % 360 } as any}
    >
      {previews[a.id] ? (
        <img src={previews[a.id]} alt={`${a.name} preview`} />
      ) : (
        <>
          <div className="orbits" />
          <span className="preview-letter">
            <FrameworkIcon type={a.type} size={72} />
          </span>
          <span className="preview-type">{a.type} / LOCAL APP</span>
        </>
      )}
    </div>
  );
  const controls = (a: any) => (
    <div className="controls">
      {!running(a) ? (
        <button className="primary" onClick={() => action(a, "run")}>
          <Play size={15} />
          Run app
        </button>
      ) : status(a) !== "Running Externally" ? (
        <>
          <button onClick={() => action(a, "stop")}>
            <Square size={14} />
            Stop
          </button>
          <button title="Restart" onClick={() => action(a, "restart")}>
            <RotateCw size={15} />
          </button>
        </>
      ) : (
        <span className="muted">Managed externally</span>
      )}
      <button disabled={!(r.url || a.url)} onClick={() => action(a, "open")}>
        <ExternalLink size={15} />
        Open
      </button>
    </div>
  );
  return (
    <div className="app" data-theme={settings.appearance || "dark"}>
      <aside inert={onboarding}>
        <div className="traffic-space" />
        <div className="brand">
          <span className="logo">
            a<span>↗</span>
          </span>
          <span className="space-name" title={spaceName}>
            {spaceName}
          </span>
        </div>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {Object.keys(icons).map((f) => {
            const Icon = icons[f];
            return (
              <button
                className={page === "library" && filter === f ? "active" : ""}
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage("library");
                  setSelected(null);
                }}
              >
                <Icon size={18} />
                {f === "All" ? "Your library" : f}
                <span>
                  {f === "All"
                    ? apps.length
                    : f === "Running"
                      ? apps.filter(running).length
                      : ""}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="workspace-label roots-label">
          FOLDERS
          <button title="Add root folder" onClick={() => scan("chooseRoot")}>
            <Plus size={14} />
          </button>
        </div>
        <div className="roots">
          {settings.roots.map((p: string) => (
            <div key={p} title={p}>
              <Folder size={15} />
              {p.split("/").pop()}
            </div>
          ))}
          {!settings.roots.length && (
            <span className="muted">No folders connected</span>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local">
            <span className="dot" />
            Everything stays on your Mac
          </div>
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => {
              setPage("settings");
              setSelected(null);
            }}
          >
            <Settings size={17} />
            Settings
          </button>
          <div className="profile">
            <div>{spaceBadge(spaceName, settings.avatar)}</div>
            <span>
              {spaceName}
              <small>LOCAL WORKSPACE</small>
            </span>
            <Command size={15} />
          </div>
        </div>
      </aside>
      <main inert={onboarding}>
        <header>
          <div className="breadcrumb">
            Your space <span>/</span>{" "}
            {page === "settings" ? "Settings" : a ? a.name : "Library"}
          </div>
          <div className="header-right">
            <span className="dot" /> Local environment{" "}
            <span className="version">MVP 0.1</span>
          </div>
        </header>
        {error && (
          <div className="error">
            {error}
            <button onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {page === "settings" ? (
          <section>
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h1>Settings</h1>
            <p className="subtitle">
              A little housekeeping for your local universe.
            </p>
            <div className="settings-panel">
              <SpaceProfile
                key={`${settings.spaceName}:${settings.avatar}`}
                initialName={spaceName}
                initialAvatar={settings.avatar || ""}
                onSave={async (values) => {
                  await api("profile", values);
                  await sync();
                }}
              />
              <h3>Library folders</h3>
              {settings.roots.map((p: string) => (
                <div className="setting-row" key={p}>
                  <code>{p}</code>
                  <button
                    onClick={() =>
                      run(async () => {
                        await saveSettings({
                          roots: settings.roots.filter((x: string) => x !== p),
                        });
                        await scan();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button onClick={() => scan("chooseRoot")}>
                <Plus size={16} />
                Add root folder
              </button>
              <h3>Excluded folder trees</h3>
              {settings.excluded.map((p: string) => (
                <div className="setting-row" key={p}>
                  <code>{p}</code>
                  <button
                    onClick={() =>
                      run(async () => {
                        await saveSettings({
                          excluded: settings.excluded.filter(
                            (x: string) => x !== p,
                          ),
                        });
                        await scan();
                      })
                    }
                  >
                    Restore
                  </button>
                </div>
              ))}
              <button onClick={() => scan("exclude")}>
                <Plus size={16} />
                Exclude a folder
              </button>
              <div className="setting-row">
                <label>Scan on startup</label>
                <input
                  type="checkbox"
                  checked={!!settings.autoScan}
                  onChange={(e) => saveSettings({ autoScan: e.target.checked })}
                />
              </div>
              <div className="setting-row">
                <label>Scan depth</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.depth || 8}
                  onChange={(e) =>
                    saveSettings({ depth: Number(e.target.value) })
                  }
                />
              </div>
              <div className="setting-row">
                <label>Default editor</label>
                <select
                  value={settings.editor}
                  onChange={(e) => saveSettings({ editor: e.target.value })}
                >
                  <option>Cursor</option>
                  <option>Visual Studio Code</option>
                </select>
              </div>
              <div className="setting-row">
                <label>Appearance</label>
                <select
                  value={settings.appearance}
                  onChange={(e) => saveSettings({ appearance: e.target.value })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>
              <h3>Hidden / marked not an app</h3>
              {Object.entries(settings.overrides)
                .filter(([, o]: any) => o.hidden || o.notApp)
                .map(([p]) => (
                  <div className="setting-row" key={p}>
                    <code>{p}</code>
                    <button
                      onClick={() =>
                        run(async () => {
                          await api("restore", { path: p });
                          await sync();
                        })
                      }
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </div>
          </section>
        ) : a ? (
          <section className="detail">
            <button className="back" onClick={() => setSelected(null)}>
              <ChevronLeft size={16} />
              Back to library
            </button>
            <div className="detail-hero">
              {preview(a, true)}
              <div>
                <div className="eyebrow">
                  {a.type} · {a.hierarchy}
                </div>
                <h1>{a.name}</h1>
                <p className="subtitle">
                  {a.parent || "Your local application"}
                </p>
                <span className={`status ${running(a) ? "on" : ""}`}>
                  <i />
                  {status(a)}
                </span>
                {controls(a)}
                <button
                  className="text-button"
                  onClick={() =>
                    run(async () => {
                      const p = await api("capture", { id: a.id });
                      setPreviews({ ...previews, [a.id]: p });
                    })
                  }
                >
                  <Camera size={15} />
                  Refresh preview
                </button>
                <p className="muted wrap">
                  Auto-captured when ready. Saved to{" "}
                  {previewPaths[a.id] || "this repository"}
                </p>
                {previewErrors[a.id] && (
                  <p className="amber">Preview: {previewErrors[a.id]}</p>
                )}
              </div>
            </div>
            <div className="detail-columns">
              <div>
                <div className="panel">
                  <div className="panel-title">
                    <h3>Launch configuration</h3>
                    <button onClick={() => setDraft({ ...a })}>Edit</button>
                  </div>
                  <dl>
                    <dt>Command</dt>
                    <dd>
                      <code>{a.command || "No command configured"}</code>
                    </dd>
                    <dt>Working directory</dt>
                    <dd>{a.cwd}</dd>
                    <dt>Local URL</dt>
                    <dd>{r.url || a.url || "Not configured"}</dd>
                    {r.portConflict && (
                      <>
                        <dt>Port conflict</dt>
                        <dd className="amber">{r.portConflict}</dd>
                      </>
                    )}
                    <dt>Port / PID</dt>
                    <dd>
                      {r.port || a.port || "—"} / {r.pid || "—"}
                    </dd>
                    <dt>Running duration</dt>
                    <dd>
                      {r.pid && r.started
                        ? `${Math.floor((Date.now() - r.started) / 1000)} seconds`
                        : "—"}
                    </dd>
                    <dt>Project path</dt>
                    <dd>{a.path}</dd>
                    <dt>Parent hierarchy</dt>
                    <dd>
                      {a.hierarchy}
                      {a.parent ? " / " + a.parent : ""}
                    </dd>
                  </dl>
                </div>
                <ReadmePanel key={a.id} id={a.id} />
                <div className="panel">
                  <h3>Quick actions</h3>
                  <div className="quick-actions">
                    {[
                      "editor",
                      "Cursor",
                      "Visual Studio Code",
                      "Terminal",
                      "Finder",
                      "path",
                      "url",
                    ].map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          run(() => api("quick", { id: a.id, target: t }))
                        }
                      >
                        {t === "path" || t === "url" ? (
                          <Copy size={14} />
                        ) : (
                          <ArrowUpRight size={14} />
                        )}{" "}
                        {t === "editor"
                          ? "Default editor"
                          : t === "path"
                            ? "Copy path"
                            : t === "url"
                              ? "Copy URL"
                              : t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <h3>Library actions</h3>
                  <div className="quick-actions">
                    <button
                      onClick={() => override(a, { favorite: !a.favorite })}
                    >
                      <Star size={14} />
                      {a.favorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button onClick={() => override(a, { hidden: true })}>
                      Hide
                    </button>
                    <button onClick={() => override(a, { notApp: true })}>
                      Not an app
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await saveSettings({
                            excluded: [...settings.excluded, a.path],
                          });
                          await scan();
                        })
                      }
                    >
                      Exclude tree
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div className="panel">
                  <h3>
                    <GitBranch size={16} />
                    Git information
                  </h3>
                  {a.git ? (
                    <>
                      <div className="git-summary">
                        <span>{a.git.branch}</span>
                        <span className={a.git.dirty ? "amber" : "green"}>
                          {a.git.dirty ? "Uncommitted changes" : "Clean"}
                        </span>
                      </div>
                      <p className="muted">
                        {a.git.modified} modified · {a.git.untracked} untracked
                        · ↑ {a.git.ahead} ↓ {a.git.behind}
                      </p>
                      <p>
                        <span className="muted">Latest commit: </span>
                        {a.git.last || "No commits yet"}
                      </p>
                      <div className="divider" />
                      <div className="eyebrow">GIT IDENTITY</div>
                      <p>
                        {a.git.name || "Not configured"}
                        <br />
                        <span className="muted">{a.git.email}</span>
                      </p>
                      <div className="eyebrow">REMOTE ORIGIN</div>
                      <p className="wrap">{a.git.remote || "No remote"}</p>
                      <GitHistory
                        key={a.id}
                        id={a.id}
                        revision={a.git.committedAt}
                      />
                    </>
                  ) : (
                    <p className="muted">
                      This app is not in a Git repository.
                    </p>
                  )}
                </div>
                <div className="panel logs-panel">
                  <h3>
                    <Terminal size={16} />
                    Process output<span>LIVE</span>
                  </h3>
                  <pre>
                    {r.logs || "Run this app to see stdout and stderr here."}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div className="title-row">
              <div>
                <div className="eyebrow">GOOD IDEAS START HERE</div>
                <h1>
                  {filter === "All" ? "Your local universe." : filter + "."}
                </h1>
                <p className="subtitle">
                  {filter === "Changed"
                    ? "Uncommitted Git changes · most recently edited first"
                    : "All your apps. One place to make things happen."}
                </p>
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => scan("chooseRoot")}
              >
                <Plus size={16} />
                Add folder
              </button>
            </div>
            <div className="library-summary">
              <span>
                <strong>{apps.length}</strong> apps in your space
              </span>
              <span>
                <i className="dot" />
                <strong>{apps.filter(running).length}</strong> running now
              </span>
              <span>
                <GitBranch size={14} />
                {apps.filter((a) => a.git?.dirty).length} with changes
              </span>
            </div>
            <div className="toolbar">
              <div className="tabs">
                {["All", "Running", "Favorites"].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "selected" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="search">
                <Search size={16} />
                <input
                  placeholder="Find an app..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                disabled={busy}
                title="Rescan folders"
                onClick={() => scan()}
              >
                <RefreshCw size={16} className={busy ? "spin" : ""} />
                {busy ? "Scanning" : "Rescan"}
              </button>
              <button
                title="Manually add an app"
                onClick={() => scan("manual")}
              >
                <Plus size={16} />
              </button>
            </div>
            {visible.length ? (
              <div className="grid">
                {visible.map((a) => (
                  <article
                    key={a.id}
                    className="card"
                    onClick={() => setSelected(a.id)}
                  >
                    <div className="card-image">
                      {preview(a)}
                      <button
                        className={`favorite ${a.favorite ? "is-favorite" : ""}`}
                        title="Favorite"
                        onClick={(e) => {
                          e.stopPropagation();
                          override(a, { favorite: !a.favorite });
                        }}
                      >
                        <Star
                          size={16}
                          fill={a.favorite ? "currentColor" : "none"}
                        />
                      </button>
                      <span className={`status ${running(a) ? "on" : ""}`}>
                        <i />
                        {status(a)}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="card-name">
                        <h2>{a.name}</h2>
                        <span className="framework-badge">
                          <FrameworkIcon type={a.type} />
                          {a.type}
                        </span>
                      </div>
                      <p className="parent" title={a.path}>
                        {a.parent || a.hierarchy}
                      </p>
                      <p className="hierarchy">
                        {a.parent ? a.hierarchy : "Local application"}
                      </p>
                      <div className="card-footer">
                        <span>
                          <GitBranch size={13} />
                          {a.git?.branch || "No Git"}
                          {a.git?.dirty && <i className="change-dot" />}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            action(a, running(a) ? "open" : "run");
                          }}
                        >
                          {running(a) ? (
                            <ExternalLink size={14} />
                          ) : (
                            <Play size={14} />
                          )}{" "}
                          {running(a) ? "Open" : "Run"}
                        </button>
                      </div>
                      <div className="card-url">
                        {runtime[a.id]?.url ||
                          a.url ||
                          "Configure a local URL in app details"}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <Code size={36} />
                </div>
                <h2>
                  {busy
                    ? "Exploring your folders…"
                    : apps.length
                      ? "No apps match this view"
                      : "A space for everything you build."}
                </h2>
                <p>
                  {apps.length
                    ? "Try another filter or search."
                    : "Connect your Repository folder to discover apps, including nested projects."}
                </p>
                {!apps.length && (
                  <button
                    className="primary"
                    onClick={() => scan("chooseRoot")}
                  >
                    <Folder size={16} />
                    Choose a root folder
                  </button>
                )}
              </div>
            )}
            <footer>
              <span title={spaceName}>{spaceName}</span>
              <span>
                <span className="dot" /> Local only. Always yours.
              </span>
            </footer>
          </section>
        )}
      </main>
      {onboarding && (
        <div
          className="modal-backdrop onboarding"
          role="dialog"
          aria-modal="true"
          aria-labelledby="space-title"
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const elements = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "input,button:not([disabled])",
              ),
            );
            const first = elements[0],
              last = elements.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }}
        >
          <div className="modal">
            <SpaceProfile
              firstRun
              initialName={spaceName}
              initialAvatar={settings.avatar || ""}
              onSave={async (values) => {
                await api("profile", values);
                await sync();
                if (settings.autoScan) await scan();
              }}
            />
          </div>
        </div>
      )}
      {draft && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("override", {
                  id: draft.id,
                  values: {
                    name: draft.name,
                    command: draft.command,
                    cwd: draft.cwd,
                    port: Number(draft.port),
                    url: draft.url,
                  },
                });
                setDraft(null);
                await sync();
              });
            }}
          >
            <div className="panel-title">
              <h2>Make it run your way.</h2>
              <button type="button" onClick={() => setDraft(null)}>
                <X size={18} />
              </button>
            </div>
            {[
              ["name", "App name"],
              ["command", "Run command"],
              ["cwd", "Working directory"],
              ["port", "Port (0 for unknown)"],
              ["url", "Local URL"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={key === "name" || key === "cwd"}
                  type={key === "port" ? "number" : "text"}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <p className="muted">
              Commands run in your login shell. Changes apply on the next
              launch.
            </p>
            <button className="primary" type="submit">
              Save configuration
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
