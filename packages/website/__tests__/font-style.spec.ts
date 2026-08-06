import { describe, expect, it } from "vitest";
import { buildFontCss } from "../components/FontStyle";
import type { FontSettingProp } from "../api/getAllData";

describe("buildFontCss", () => {
  it("returns empty for undefined or off mode", () => {
    expect(buildFontCss(undefined)).toBe("");
    expect(buildFontCss({ mode: "off", scope: "body" })).toBe("");
  });

  it("preset mode with cn+en emits en-first, cn-second family rule with !important", () => {
    const css = buildFontCss({
      mode: "preset",
      scope: "body",
      enFont: "ebgaramond",
      cnFont: "lxgw",
    });
    expect(css).toContain("html .vanblog-main");
    // 正文容器 .markdown-body 也被显式命中（压过其自带 font-family）
    expect(css).toContain("html .markdown-body");
    // 英文在前、中文在后
    expect(css.indexOf('"EB Garamond"')).toBeLessThan(css.indexOf('"LXGW WenKai"'));
    expect(css).toContain("!important");
    expect(css).not.toContain("@font-face");
    // 内容区内的表单控件还原为系统 UI 字体
    expect(css).toContain(":is(button, input, select, textarea)");
    expect(css).toContain("ui-sans-serif");
  });

  it("preset with only cn selected falls back en to system", () => {
    const css = buildFontCss({ mode: "preset", scope: "body", cnFont: "misans", enFont: "system" });
    expect(css).toContain('"MiSans"');
    expect(css).not.toContain('"EB Garamond"');
    expect(css).toContain("PingFang SC"); // 系统回退
  });

  it("preset with both sides system emits nothing", () => {
    expect(buildFontCss({ mode: "preset", scope: "body", cnFont: "system", enFont: "system" })).toBe("");
    // 缺省也视作 system
    expect(buildFontCss({ mode: "preset", scope: "body" })).toBe("");
  });

  it("preset site scope targets whole body", () => {
    const css = buildFontCss({ mode: "preset", scope: "site", cnFont: "songti", enFont: "system" });
    expect(css.startsWith("html body,")).toBe(true);
    expect(css).toContain("html body, html .markdown-body {");
    expect(css).toContain('"Source Han Serif SC"');
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
    expect(css).toContain('html .vanblog-main, html .markdown-body { font-family: "MyFont", sans-serif !important; }');
    expect(css).toContain('html .vanblog-main :is(button, input, select, textarea)');
  });

  it("custom mode without faces still emits the family rule", () => {
    const css = buildFontCss({
      mode: "custom",
      scope: "site",
      fontFamily: '"X", serif',
      faces: [],
    });
    expect(css).not.toContain("@font-face");
    expect(css).toContain('html body, html .markdown-body { font-family: "X", serif !important; }');
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
