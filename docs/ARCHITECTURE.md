# Architecture and behavior

## Application boundary

Electron main owns native operations. React invokes named actions through the isolated preload bridge; IPC validates both the owning window and main frame. The renderer uses bundled assets with a restrictive content security policy. No remote backend, login, telemetry, or cloud sync is implemented.

Discovery recursively reads configured roots, skips generated/hidden directories and directory symlinks, and continues into nested projects. Supported evidence includes launchable package scripts, Python entry points, Go `package main`, Rust binary targets, Compose manifests, and HTML with assets. Package names or folder names alone are insufficient. Python launchers prefer `.venv/bin/python`, then `venv/bin/python`, then system Python. Recognized FastAPI instances in common entry files take precedence over batch CLI entry points. This is conservative source inspection, not a Python parser or import.

Apps use a hash of their absolute path as ID. A shared Git root does not merge nested apps. Overrides are keyed by absolute app path and applied after detection. Cached library entries support startup with auto scan disabled.

## Runtime and external detection

Managed commands execute in a detached process group through the user's login shell. Stdout/stderr retain the most recent 100 KB in memory. Stop sends SIGTERM then SIGKILL to the managed group; closing Ajo Space stops managed apps. Explicit CLI `--run <id-or-absolute-path>` requests a launch after discovery.

Status refreshes approximately every 2.5 seconds. A known TCP port or a localhost URL emitted in logs supplies readiness. A process without a known port is considered ready after remaining alive; this is not an HTTP health check.

For an externally launched service, `lsof` identifies the listener and its working directory. All visible TCP listening ports are inspected, including ports different from the launch configuration. The most specific matching working directory wins; equal/ambiguous candidates are not marked running. Each listener is attributed independently; multiple listeners are grouped under one app, preserving app-based counts. An unrelated listener creates a port conflict, not a running app.

External detection requires a readable matching working directory. A command started from another directory, containers, remote servers, and background programs without a listener may not be identified. External stdout/stderr, start time, Stop and Restart are unavailable. The configured port is preferred as the primary URL when present; otherwise the lowest detected port is used. The detail page exposes every detected listener URL and PID. Manage external processes in the terminal that started them.

## Git semantics and ordering

**Changed** means uncommitted changes reported by Git: staged/unstaged modifications, additions, deletions, renames, and untracked files. A clean repository with a recent commit does not appear in Changed.

Changed is sorted descending by the newest changed-file filesystem modification time. Missing/deleted files use their containing directory's modification time as an estimate; last commit time is a fallback. This is edit recency, not an audit trail or commit ordering. Ties use app name and path. Other views retain alphabetical ordering. Nested apps sharing one repository share its Git status and timestamps.

Git refreshes about every 30 seconds while the desktop polls state, or immediately on Rescan. NUL-delimited porcelain output preserves unusual filenames and rename records. Ajo Space's generated `.ajo-space` artifacts are excluded from its dirty counts and recency; actual Git may still show them as untracked. Effective `user.name` and `user.email` describe Git identity, not repository ownership.

## Preview lifecycle

When a managed app becomes Ready, or an external app is identified, capture its configured local web URL in a separate hidden sandboxed BrowserWindow. Wait briefly for rendering, save PNG plus JSON metadata, and notify React through a version value on the next state poll. No forms or app jobs are submitted. Captures are serialized and deduplicated per launch signature, with at most three attempts and a 30-second retry delay. An explicit Refresh preview remains available.

Canonical path: `<git-root>/.ajo-space/previews/<app-id>.png` and `.json`. For non-Git projects use `<app-path>/.ajo-space/previews/`. A second image is cached in application data; reads prefer the repository image. Nested apps get separate IDs/files. Authentication in the user's browser is not shared with the capture session. Capture errors remain visible in app details. A changed primary external listener PID triggers a new preview; use Refresh preview for content changes within the same process.

## Local data and deployment

`~/Library/Application Support/Ajo Space/` contains `settings.json`, `library.json`, and the fallback `previews/` cache. Settings writes use a temporary file and rename. Overrides, exclusions and root selection persist; managed runtime state and logs do not. `AJO_SPACE_DATA_DIR` redirects application data for isolated tests.

The signed/notarized distribution flow is intentionally absent. `npm run package` builds an unsigned app for the host architecture. Source changes require rebuilding, copying the bundle to the installation location, and restarting. Avoid disrupting managed jobs during that process.

## On-demand commit history

The `gitHistory` IPC action accepts a known app ID and a bounded offset. `electron/git-history.ts` reads the current branch’s log in pages of 20 (plus one sentinel); the UI expands full messages and shows author/committer dates, hashes and decorations. History is current-branch reachable history, not every branch or a PR discussion feed. NUL-separated fields preserve multiline messages. It is read on opening details or using Refresh, and refreshed when the latest commit timestamp changes. No remote network request is made.

The upstream tip and local-only commit membership come from the locally cached `@{upstream}` reference. “Last recorded push” scans the latest 200 local upstream reflog entries for the explicit `update by push` event and uses that entry’s timestamp. A missing event remains unknown; it must never be replaced with a commit timestamp or presented as a repository-wide last-push guarantee. Reflogs expire and are machine-local. Pagination is bounded to 5,020 commits.

Multiple explicit `--run <id-or-path>` arguments can restore several managed development servers after a controlled desktop update. They never authorize adopting or stopping externally launched processes.

## Workspace identity and first launch

`electron/profile.ts` provides shared validation: a trimmed name up to 32 Unicode grapheme clusters and an optional badge up to two graphemes. Blank names become Ajo Space. The default badge is AJ; custom names get automatic initials unless a badge is supplied. Controls and multiline characters are rejected. The main process validates profile writes independently of the renderer.

A fresh profile starts with `onboardingComplete: false`. First launch prompts for the workspace identity and offers Use Ajo Space. Saving persists `spaceName`, `avatar` and completion in application data; Settings uses the same validation. The dialog keeps focus inside and makes the background inert. No OS username or account email is used to derive identity. Existing installations without a profile are prompted once. Product bundle/window identity remains Ajo Space; the workspace name appears in its sidebar and footer.

## README viewer and detail layout

The `readme` IPC action accepts only a known app ID. `electron/readme.ts` looks for a case-insensitive README.md at the app path, then the Git root; it does not recursively search or accept an arbitrary renderer-supplied filepath. Reads use a bounded 256 KiB buffer, preserve UTF-8 boundaries, and reject symlinks outside the selected project directory. Absence, empty content, errors and truncation have distinct UI states.

`src/ReadmePanel.tsx` renders Markdown with GFM tables but no raw HTML, executable content, active links or loaded images. Refresh and app changes cancel stale responses. README and Git-history bodies are separate keyboard-focusable scroll regions; maximum heights are 420 px and 480 px. Expanded commit message bodies have a 220 px bound. Region headers remain outside the scroll areas.
