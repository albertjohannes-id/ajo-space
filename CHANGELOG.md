# Changelog

## 0.1.0 — local MVP (2026-09-08)

### Latest updates

- Added first-launch workspace naming (32 Unicode characters), customizable emoji/initials badge and Settings rename controls.
- Replaced personal branding with neutral Ajo Space / AJ defaults.
- Prepared public documentation, synthetic screenshots, privacy exclusions and an optional macOS CI template.

- Added expandable current-branch commit history, full comments/messages, author/date/hash details and older-history pagination.
- Added locally recorded push activity and cached upstream commit information, explicitly separating push timestamps from commit dates.

- Clarified Changed as uncommitted Git changes and sorted that view by newest edited files first.
- Added periodic Git refresh and NUL-delimited status parsing for spaces, newlines and renames.
- Excluded generated `.ajo-space` previews from Ajo Space's Git-change counts and ordering.
- Added an AI agent guide, architecture reference, testing instructions and troubleshooting.

### Earlier MVP updates

- Fixed external-process attribution: shared default ports no longer inflate running counts.
- Added offline language/framework logos and automatic repository-local previews.
- Fixed Python detection to prefer existing virtual environments and recognized FastAPI web entry points over batch scripts.
- Shipped recursive app discovery, parent hierarchy, library/search/filters, favorites, Git metadata, process controls and logs, manual overrides, settings, native editor/Finder/Terminal actions, and an unsigned macOS application bundle.
