/** Changed means dirty Git worktrees; timestamp is the latest changed-file mtime. */
export function newestChangedFirst(
  a: { name: string; path: string; git?: { changedAt?: number } },
  b: { name: string; path: string; git?: { changedAt?: number } },
) {
  return (
    (b.git?.changedAt || 0) - (a.git?.changedAt || 0) ||
    a.name.localeCompare(b.name) ||
    a.path.localeCompare(b.path)
  );
}
