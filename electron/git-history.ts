import { exec } from "./core.js";
export type Commit = {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  authoredAt: string;
  committedAt: string;
  subject: string;
  body: string;
  refs: string;
  localOnly?: boolean;
};
const format = "%H%x00%h%x00%an%x00%ae%x00%aI%x00%cI%x00%s%x00%b%x00%D%x00";
function commits(raw: string): Commit[] {
  const fields = raw.split("\0");
  const result: Commit[] = [];
  for (let i = 0; i + 8 < fields.length; i += 9) {
    const [
      hash,
      shortHash,
      author,
      email,
      authoredAt,
      committedAt,
      subject,
      body,
      refs,
    ] = fields.slice(i, i + 9);
    if (!hash.trim()) continue;
    result.push({
      hash: hash.trim(),
      shortHash,
      author,
      email,
      authoredAt,
      committedAt,
      subject,
      body: body.trim(),
      refs,
    });
  }
  return result;
}
export async function gitHistory(dir: string, offset = 0) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 5000)
    throw Error("Invalid history offset.");
  const g = async (...args: string[]) => {
    try {
      return (
        await exec("git", ["-C", dir, ...args], {
          timeout: 5000,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        })
      ).stdout;
    } catch {
      return "";
    }
  };
  const root = (await g("rev-parse", "--show-toplevel")).trim();
  if (!root) throw Error("This app is not in a Git repository.");
  const upstream = (
    await g("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
  ).trim();
  const [historyRaw, upstreamRaw, localRaw, reflog] = await Promise.all([
    g(
      "log",
      `--skip=${offset}`,
      "-21",
      "--date-order",
      `--format=${format}`,
      "HEAD",
    ),
    upstream
      ? g("log", "-1", `--format=${format}`, "@{upstream}")
      : Promise.resolve(""),
    upstream ? g("rev-list", "@{upstream}..HEAD") : Promise.resolve(""),
    upstream
      ? g(
          "reflog",
          "show",
          "-200",
          "--date=iso-strict",
          "--format=%H%x00%gD%x00%gs%x00",
          "@{upstream}",
        )
      : Promise.resolve(""),
  ]);
  const local = new Set(localRaw.trim().split("\n"));
  const entries = commits(historyRaw);
  entries.forEach((c) => {
    if (upstream) c.localOnly = local.has(c.hash);
  });
  let lastPush:
    { at: string; hash: string; message: string; commit?: Commit } | undefined;
  const records = reflog.split("\0");
  for (let i = 0; i + 2 < records.length; i += 3) {
    const [hash, selector, message] = records.slice(i, i + 3);
    if (!/^update by push\b/.test(message)) continue;
    const at = selector.match(/@\{(.+)\}$/)?.[1];
    if (at && !Number.isNaN(Date.parse(at))) {
      lastPush = {
        at,
        hash: hash.trim(),
        message,
        commit: commits(
          await g("show", "-s", `--format=${format}`, hash.trim()),
        )[0],
      };
      break;
    }
  }
  return {
    root,
    upstream: upstream || null,
    commits: entries.slice(0, 20),
    hasMore: entries.length > 20 && offset + 20 <= 5000,
    offset,
    lastPush: lastPush || null,
    upstreamCommit: commits(upstreamRaw)[0] || null,
  };
}
