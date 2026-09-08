# Optional GitHub Actions CI

The repository includes a reviewed [macOS CI template](ci-example.yml) that installs dependencies, runs the tests and builds the app on Node.js 24. Actions are pinned to release commit hashes.

To enable it, copy the template to `.github/workflows/ci.yml` and commit it using GitHub access that permits workflow updates. The initial publishing credential did not include that permission, so no workflow is active by default. Local validation commands work independently:

```sh
npm ci
npm test
npm run build
```

Keep the template's read-only `contents` permission. CI uses temporary fixtures; it must never connect to private project repositories or upload local screenshots or application data.
