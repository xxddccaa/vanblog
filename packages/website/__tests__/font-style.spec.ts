import { describe, expect, it } from "vitest";
import { buildFontCss } from "../components/FontStyle";
import type { FontSettingProp } from "../api/getAllData";

describe("buildFontCss", () => {
  it("returns empty for undefined or off mode", () => {
    expect(buildFontCss(undefined)).toBe("");
    expect(buildFontCss({ mode: "off", scope: "body" })).toBe("");
  });

  it("preset mode emits scoped font-family rule with !important", () => {
    const css = buildFontCss({ mode: "preset", scope: "body" });
    expect(css).toContain("html .markdown-body");
    expect(css).toContain("EB Garamond");
    expect(css).toContain("LXGW WenKai");
    expect(css).toContain("!important");
    // preset 不内联 @font-face（由 preset-fonts.css 提供）
    expect(css).not.toContain("@font-face");
  });

  it("preset site scope targets body", () => {
    const css = buildFontCss({ mode: "preset", scope: "site" });
    expect(css.startsWith("body {")).toBe(true);
    expect(css).not.toContain(".markdown-body");
  });

  it("custom mode emits @font-face with font-display swap and the family rule", () => {
    const font: FontSettingProp = {
      mode: "custom",
      scope: "body",
      fontFamily: '"MyFont", sans-serif',
      faces: [
        {
          family: "MyFont",
          src: "/static/font/abc123.MyFont.woff2",
          format: "woff2",
          weight: "normal",
          style: "normal",
        },
      ],
    };
    const css = buildFontCss(font);
    expect(css).toContain("@font-face");
    expect(css).toContain('font-family: "MyFont"');
    expect(css).toContain('url("/static/font/abc123.MyFont.woff2")');
    expect(css).toContain('format("woff2")');
    expect(css).toContain("font-display: swap");
    expect(css).toContain('html .markdown-body { font-family: "MyFont", sans-serif !important; }');
  });

  it("custom mode without faces still emits the family rule", () => {
    const css = buildFontCss({
      mode: "custom",
      scope: "site",
      fontFamily: '"X", serif',
      faces: [],
    });
    expect(css).not.toContain("@font-face");
    expect(css).toContain('body { font-family: "X", serif !important; }');
  });

  it("custom mode with neither faces nor family emits nothing", () => {
    expect(buildFontCss({ mode: "custom", scope: "body", faces: [] })).toBe("");
  });

  it("strips style-breaking characters from font family / src", () => {
    const css = buildFontCss({
      mode: "custom",
      scope: "body",
      fontFamily: '"Ev<il>{}", serif',
      faces: [{ family: "E{v}il", src: '/static/font/x".woff2', format: "woff2" }],
    });
    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
    expect(css).not.toContain("{v}");
  });
});
