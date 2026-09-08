# Security and privacy

## Local-first behavior

Ajo Space stores your workspace profile, folder selection, overrides and cached library in the operating system's application-data directory. It has no product login, telemetry, analytics or cloud synchronization.

The app displays local repository paths, Git identities/remotes, commit messages and process logs by design. These are your local data, not bundled sample content. Commands run with your user account's privileges after you choose Run. Only run repositories you trust.

Previews are saved in each project's `.ajo-space/previews/` folder and cached locally. Screenshots may contain sensitive application data. They are not uploaded by Ajo Space, but could be committed if you add them to Git yourself. Review or ignore this folder before publishing a project. We exclude previews from Ajo Space's Changed view without changing your Git ignore rules.

Launched applications and previewed webpages may make their own network requests. Ajo Space does not isolate those applications from the network. A preview is loaded in a sandboxed browser session without the desktop app's privileged bridge or your normal browser login.

## Reporting

Do not post credentials, private repository content or exploitable security details in public issues. Use GitHub's **Report a vulnerability** option if enabled for the repository. Otherwise open a minimal issue requesting a private contact method without disclosing the vulnerability, then wait for the maintainer's response.

This is an early personal-tool MVP, not a hardened multi-user sandbox. Public binaries are not currently signed or notarized.
