import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
test("README renders Markdown in an accessible scroll region without active links, scripts or image requests", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost",
  });
  const w = dom.window;
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    HTMLElement: w.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  (w as any).ajo = {
    call: async () => ({
      name: "README.md",
      content:
        "# Project guide\n\n**Bold text**\n\n[External link](https://example.invalid)\n\n![Remote image](https://example.invalid/image.png)\n\n<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |",
      path: "/fixture/README.md",
      truncated: false,
      repositoryFallback: false,
    }),
  };
  const { createRoot } = await import("react-dom/client");
  const { createElement, act } = await import("react");
  const { ReadmePanel } = await import("../src/ReadmePanel");
  const root = createRoot(w.document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(createElement(ReadmePanel, { id: "fixture" }));
    });
    const region = w.document.querySelector('[aria-label="README content"]')!;
    assert.equal(region.getAttribute("tabindex"), "0");
    assert.ok(region.querySelector("h1"));
    assert.ok(region.querySelector("strong"));
    assert.ok(region.querySelector("table"));
    assert.equal(region.querySelector("script"), null);
    assert.equal(region.querySelector("img"), null);
    assert.equal(region.querySelector("a"), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
