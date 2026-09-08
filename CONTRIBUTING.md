# Contributing to Ajo Space

Ajo Space is a macOS-first desktop project. Small, focused improvements with a reproducible example are welcome.

## Develop

1. Use macOS, Node.js 22.12+ (24 recommended), npm and Git.
2. Run `npm ci`, then `npm run dev`.
3. Read [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md).
4. Use temporary repositories for discovery, process and Git tests. Do not publish screenshots of real private projects.
5. Run `npm test` and `npm run build`. Run `npm run test:previews` for preview changes and `npm run test:desktop` for UI changes when a graphical session is available.
6. Update documentation and the changelog with changes to behavior or limitations.

## Pull requests

Explain the problem, resulting behavior and validation. Keep process operations in Electron main, keep external processes read-only, and preserve manual overrides. Tests should verify meaningful behavior rather than mirror implementation details.

Do not include generated bundles, `artifacts/`, application data, `.ajo-space/`, `.env` files, credentials or local absolute paths. Public issue reports should use synthetic project names and redacted logs.

Contributions are covered by the repository's MIT license. Framework logos remain subject to their respective trademark and asset terms.
