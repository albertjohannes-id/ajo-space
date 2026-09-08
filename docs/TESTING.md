# Testing and maintenance

## Commands

| Command                 | Checks                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`              | Real temporary filesystem/Git fixtures, discovery, overrides, Python launcher selection, process lifecycle, external listener attribution, shared ports, Changed recency and generated-preview exclusion |
| `npm run build`         | TypeScript checks for main and renderer; production Vite bundle                                                                                                                                          |
| `npm run test:previews` | Electron capture component with a temporary HTTP server; automatic capture, PNG persistence/reload, deduplication and distinct nested-app files                                                          |
| `npm run test:desktop`  | Electron interface smoke flow in an isolated data directory: discover, run, Ready, refresh preview, restart, stop, rename                                                                                |
| `npm run package`       | Unsigned macOS app bundle                                                                                                                                                                                |

Tests should use temporary directories and ephemeral ports, clean up fixtures and stop only their own processes. Desktop smoke needs a graphical macOS session and available automation permissions. Do not use production extraction jobs as test fixtures. Preview component tests install a window-all-closed handler so destroying a hidden capture window does not terminate the harness prematurely.

Git history tests create a temporary bare local remote, push only to that fixture, and verify multiline messages, actual push reflog events, cached-upstream comparison, pagination, empty repositories and detached HEAD. Never push to the user’s real remotes for validation.

## Manual acceptance

1. Add a root containing both a direct app and nested runnable apps. Verify distinct IDs and parent context.
2. Launch one app. Check readiness, URL, logs, automatic preview, Stop and Restart.
3. Launch a service from Terminal in its project directory at its configured port. Verify Running Externally and Open, with no Stop or Restart control.
4. Configure another app for the same port. Only the actual owner should count as running.
5. Edit files in two repositories. After Rescan (or background refresh), Changed should place the latest edit first. Commit all changes in one: it should leave Changed.
6. Capture a preview in an otherwise clean repository. Generated `.ajo-space` files alone must not make Ajo Space report Changed.
7. Relaunch the desktop. Settings and previews persist; no automatic app launch unless explicitly requested with `--run`.

## Common troubleshooting

- Python missing module: verify the launch command uses the project's virtual environment. Prefer the project's documented web server over a batch CLI. Ajo Space does not install dependencies automatically.
- External app missing: configure its actual port and URL; ensure the listening process's working directory identifies the app. Docker and unrelated working directories may not match.
- Preview missing: verify the local URL responds and does not require a browser login. Inspect the preview error in details and use Refresh preview.
- Changed seems stale: use Rescan; background refresh is roughly every 30 seconds. Changed means uncommitted files, not latest commits. Deletion recency is approximate.
- Installed app seems stale: confirm the rebuilt bundle was copied to `~/Applications/Ajo Space.app`; `npm run build` alone only updates source build output.
