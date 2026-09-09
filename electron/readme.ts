import fs from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { within, type AppEntry } from "./core.js";
export const README_LIMIT = 256 * 1024;
export async function readReadme(app: Pick<AppEntry, "path" | "git">) {
  const directories = [
    ...new Set([app.path, app.git?.root].filter(Boolean)),
  ] as string[];
  for (const directory of directories) {
    const root = await fs.realpath(directory);
    const entries = await fs.readdir(root);
    const name = entries
      .filter((n) => /^readme\.md$/i.test(n))
      .sort((a, b) =>
        a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b),
      )[0];
    if (!name) continue;
    const target = await fs.realpath(path.join(root, name));
    if (!within(target, root))
      throw Error("README points outside its project directory.");
    const file = await fs.open(target, "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile()) throw Error("README is not a regular file.");
      const buffer = Buffer.alloc(Math.min(stat.size, README_LIMIT));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      const decoder = new StringDecoder("utf8");
      const truncated = stat.size > README_LIMIT;
      const content =
        decoder.write(buffer.subarray(0, bytesRead)) +
        (truncated ? "" : decoder.end());
      return {
        name,
        path: path.join(root, name),
        content,
        truncated,
        repositoryFallback: directory !== app.path,
      };
    } finally {
      await file.close();
    }
  }
  return null;
}
