import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateProfile,
  spaceBadge,
  characters,
} from "../electron/profile.js";
test("default identity and custom workspace validation", () => {
  assert.deepEqual(validateProfile({ spaceName: "  ", avatar: "" }), {
    spaceName: "Ajo Space",
    avatar: "",
  });
  assert.equal(spaceBadge("Ajo Space"), "AJ");
  assert.equal(spaceBadge("ajo"), "AJ");
  assert.equal(spaceBadge("Orbit Lab"), "OL");
  assert.equal(spaceBadge("Orbit Lab", "🚀"), "🚀");
  assert.equal(
    validateProfile({ spaceName: "a".repeat(32), avatar: "AJ" }).spaceName
      .length,
    32,
  );
  assert.throws(
    () => validateProfile({ spaceName: "a".repeat(33), avatar: "" }),
    /32/,
  );
  assert.throws(
    () => validateProfile({ spaceName: "Name", avatar: "ABC" }),
    /two initials/,
  );
  assert.throws(
    () => validateProfile({ spaceName: "Name\nOther", avatar: "" }),
    /single line/,
  );
  assert.throws(() => validateProfile({ spaceName: 42, avatar: "" }), /text/);
  const emoji = "👩‍💻";
  assert.equal(characters(emoji).length, 1);
  assert.equal(
    validateProfile({ spaceName: emoji.repeat(32), avatar: emoji }).avatar,
    emoji,
  );
});
