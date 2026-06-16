import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { encode } from "js-base64";

// Model the REAL App Router behavior: next/head's <Head> is a no-op and its
// children are silently dropped. The previous bug was that customCss lived
// inside <Head>, so the user's `.mouse-drag-canvas { position: fixed }` rule
// never reached the DOM, the JS-created canvas fell into normal flow at its
// intrinsic viewport height, and the resulting full-viewport of empty
// scrollable space exposed the fixed wallpaper ("pull until only background").
vi.mock("next/head", () => ({
  default: () => null,
}));

// next/script renders an inline script element so we can assert on it.
vi.mock("next/script", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("script", null, children),
}));

describe("CustomLayout custom CSS injection", () => {
  it("renders customCss into the output even though next/head is a no-op", async () => {
    const { default: CustomLayout } = await import("../components/CustomLayout");
    const css = ".mouse-drag-canvas{position:fixed;top:0;left:0;width:100%;height:100%;}";
    const html = renderToStaticMarkup(
      React.createElement(CustomLayout, { customCss: encode(css) })
    );
    expect(html).toContain("<style");
    expect(html).toContain("position:fixed");
    expect(html).toContain(".mouse-drag-canvas");
  });

  it("still injects the custom script", async () => {
    const { default: CustomLayout } = await import("../components/CustomLayout");
    const html = renderToStaticMarkup(
      React.createElement(CustomLayout, {
        customScript: encode("window.__vanblogCustom = true;"),
      })
    );
    expect(html).toContain("window.__vanblogCustom");
  });
});
