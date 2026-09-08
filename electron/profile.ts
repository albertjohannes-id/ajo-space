export const DEFAULT_SPACE_NAME = "Ajo Space";
export const MAX_SPACE_NAME = 32;
export const MAX_AVATAR = 2;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const characters = (value: string) =>
  Array.from(segmenter.segment(value), (s) => s.segment);
export function validateProfile(input: {
  spaceName?: unknown;
  avatar?: unknown;
}) {
  if (typeof input.spaceName !== "string" || typeof input.avatar !== "string")
    throw Error("Workspace name and badge must be text.");
  const spaceName = input.spaceName.trim() || DEFAULT_SPACE_NAME,
    avatar = input.avatar.trim();
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(spaceName + avatar))
    throw Error("Use a single line without control characters.");
  if (characters(spaceName).length > MAX_SPACE_NAME)
    throw Error(
      `Workspace names can contain up to ${MAX_SPACE_NAME} characters.`,
    );
  if (characters(avatar).length > MAX_AVATAR)
    throw Error("Use one emoji or up to two initials for the badge.");
  return { spaceName, avatar };
}
export function spaceBadge(name: string, avatar = "") {
  if (avatar) return avatar;
  if (/^ajo(?: space)?$/i.test(name.trim())) return "AJ";
  const words = name.trim().split(/\s+/);
  return (
    (words.length > 1
      ? characters(words[0])[0] + characters(words.at(-1)!)[0]
      : characters(name).slice(0, 2).join("")
    ).toLocaleUpperCase() || "AJ"
  );
}
