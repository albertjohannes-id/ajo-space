import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
test("workspace onboarding validates input, supports the default, and settings can rename it", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost",
  });
  const w = dom.window;
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    HTMLElement: w.HTMLElement,
    HTMLInputElement: w.HTMLInputElement,
    Event: w.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const { createElement, act } = await import("react");
  const { SpaceProfile } = await import("../src/SpaceProfile");
  const root = createRoot(w.document.getElementById("root")!);
  const saved: any[] = [];
  const onSave = async (values: any) => {
    saved.push(values);
  };
  async function fill(id: string, value: string) {
    await act(async () => {
      const input = w.document.getElementById(id)!;
      Object.getOwnPropertyDescriptor(
        w.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new w.Event("input", { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => {
      w.document
        .querySelector("form")!
        .dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
    });
  }
  try {
    await act(async () => {
      root.render(createElement(SpaceProfile, { firstRun: true, onSave }));
    });
    assert.equal(
      (w.document.getElementById("welcome-name") as HTMLInputElement).value,
      "Ajo Space",
    );
    assert.equal(w.document.querySelector(".space-avatar")!.textContent, "AJ");
    await fill("welcome-name", "x".repeat(33));
    await submit();
    assert.equal(saved.length, 0);
    assert.match(w.document.querySelector("[role=alert]")!.textContent!, /32/);
    await fill("welcome-name", "Orbit Lab");
    await fill("welcome-avatar", "🚀");
    await submit();
    assert.deepEqual(saved.at(-1), { spaceName: "Orbit Lab", avatar: "🚀" });
    await act(async () => {
      Array.from(w.document.querySelectorAll("button"))
        .find((b) => b.textContent === "Use Ajo Space")!
        .click();
    });
    assert.deepEqual(saved.at(-1), { spaceName: "Ajo Space", avatar: "" });
    await act(async () => {
      root.render(
        createElement(SpaceProfile, {
          key: "settings",
          initialName: "Orbit Lab",
          initialAvatar: "🚀",
          onSave,
        }),
      );
    });
    await fill("settings-name", "Launch Desk");
    await submit();
    assert.deepEqual(saved.at(-1), { spaceName: "Launch Desk", avatar: "🚀" });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
