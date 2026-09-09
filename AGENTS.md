# Ajo Space — guide for coding agents

A personal, local-only macOS app built with Electron, React, and TypeScript. Read `README.md` for user behavior and `docs/ARCHITECTURE.md` for design details before changing behavior. `CHANGELOG.md` records implemented changes; it is not a roadmap.

## Boundaries

- Treat the checked-out repository root as the development workspace. The user's application repositories are separate scan targets, normally under `~/Repository`.
- Never execute discovered project code during scanning. Read evidence from manifests and source; a directory name alone does not establish runnability.
- Never install dependencies or run extraction/build jobs in a discovered project simply to scan it. Launch only in response to a user's Run action or an explicit local `--run` argument.
- Keep shell, filesystem, process, Git, and screenshot operations in Electron main. Preserve the sandbox, context isolation, sender/frame validation, and narrow preload bridge. Local web previews receive no privileged bridge.
- External processes are read-only observations: never stop, restart, or adopt them. A listening default port alone does not prove project identity.
- Preserve absolute-path IDs and separate nested apps. Manual overrides take precedence. Keep Git identity separate from remote ownership.
- Save generated previews under the Git root's `.ajo-space/previews/<app-id>.png`; use the app directory if there is no Git root. Exclude this generated folder from Ajo Space's Git-change reporting. Do not silently modify target repositories' `.gitignore` files.

## Source map

- `electron/profile.ts`: shared Unicode-aware workspace-name and avatar validation. Never hardcode personal names, emails or home-directory paths in distributable files.
- `electron/core.ts`: evidence-based discovery, Python virtualenv and FastAPI detection, Git metadata and changed-file timestamps.
- `electron/readme.ts`: bounded local README discovery; preserve path boundaries and keep README content inert.
- `electron/git-history.ts`: on-demand commit pagination, cached upstream comparison and locally recorded push events. Never infer push time from commit dates.
- `electron/runtime.ts`: process groups, bounded logs, TCP readiness, external listener ownership via macOS `lsof`.
- `electron/previews.ts`: serialized sandboxed captures, retry/deduplication, repository storage and local cache.
- `electron/main.ts`: window lifecycle, IPC actions, configuration/library persistence, background Git refresh, explicit `--run <id-or-path>`.
- `electron/preload.cts`: renderer bridge. Its CommonJS extension is intentional for a sandboxed preload.
- `src/main.tsx`, `src/style.css`: interface and presentation.
- `src/ReadmePanel.tsx`: local Markdown rendering and bounded scrolling.
- `src/GitHistory.tsx`: expandable history and refresh controls.
- `src/library.ts`: Changed-view ordering. `src/FrameworkIcon.tsx`: bundled framework marks.

## Validation and delivery

See `docs/TESTING.md`. Run `npm test` and `npm run build` after changing core behavior. For capture changes also run `npm run test:previews`; use isolated fixtures. UI smoke testing is available through `npm run test:desktop` when the environment permits it. Do not claim a test passed unless it actually ran.

Update documentation whenever user-visible behavior or limitations change. Package with `npm run package`. The output is `release/mac-arm64/Ajo Space.app` on Apple Silicon. Installation is a separate copy to `~/Applications/Ajo Space.app`; rebuilding alone does not update the installed app.

Before replacing/restarting an installed app, check for its managed processes and active work. Preserve external processes. Never interrupt an active extraction job merely to deploy an interface update. State when an update remains staged rather than installed.
