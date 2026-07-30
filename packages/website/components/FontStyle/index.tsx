import React from "react";
import type { FontSettingProp } from "../../api/getAllData";

// 内置预设：霞鹜文楷（中文）+ EB Garamond（英文/数字），@font-face 由
// styles/preset-fonts.css 提供（在 (rich)/layout 恒定 import，仅声明不下载）。
// 这里只负责输出作用域上的 font-family 规则。
const PRESET_FONT_FAMILY =
  '"EB Garamond", "LXGW WenKai", "PingFang SC", "Microsoft YaHei", -apple-system, system-ui, "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';

// 作用域选择器：
// body —— 仅文章正文；用 `html` 前缀提高优先级，压过 markdown 主题 CSS 里
//         对 .markdown-body 设置的 font-family（否则换某些主题会失效）。
// site —— 全站。
function scopeSelector(scope: "body" | "site"): string {
  return scope === "site" ? "body" : "html .markdown-body";
}

function escapeFontFamily(value: string): string {
  // 只用于内联到 <style> 文本，去掉可能破坏样式块的字符。
  return value.replace(/[<>{}]/g, "");
}

function buildFaceCss(face: {
  family: string;
  src: string;
  weight?: string;
  style?: string;
  format?: string;
}): string {
  if (!face?.family || !face?.src) return "";
  const family = escapeFontFamily(face.family);
  const src = face.src.replace(/["\\]/g, "");
  const format = face.format ? ` format("${escapeFontFamily(face.format)}")` : "";
  const weight = face.weight ? `  font-weight: ${escapeFontFamily(face.weight)};\n` : "";
  const style = face.style ? `  font-style: ${escapeFontFamily(face.style)};\n` : "";
  return `@font-face {
  font-family: "${family}";
  src: url("${src}")${format};
  font-display: swap;
${weight}${style}}`;
}

export function buildFontCss(font?: FontSettingProp): string {
  if (!font || font.mode === "off") return "";
  const selector = scopeSelector(font.scope || "body");

  if (font.mode === "preset") {
    return `${selector} { font-family: ${PRESET_FONT_FAMILY} !important; }`;
  }

  // custom
  const faces = Array.isArray(font.faces) ? font.faces : [];
  const faceCss = faces.map(buildFaceCss).filter(Boolean).join("\n");
  const stack = (font.fontFamily || "").trim();
  const familyRule = stack
    ? `${selector} { font-family: ${escapeFontFamily(stack)} !important; }`
    : "";
  return [faceCss, familyRule].filter(Boolean).join("\n");
}

// 预设的 @font-face 分片声明表（~200KB）单独作为静态文件按需加载：
// 仅 preset 模式注入 <link>，off/custom 模式零成本。版本号用于发布时刷新 CDN 缓存。
const PRESET_FONTS_HREF = "/fonts/preset/preset-fonts.css";
const ASSET_VERSION =
  process.env.NEXT_PUBLIC_MARKDOWN_THEME_ASSET_VERSION || "dev";

export default function FontStyle(props: { font?: FontSettingProp }) {
  const font = props.font;
  if (!font || font.mode === "off") return null;

  const css = buildFontCss(font);
  return (
    <>
      {font.mode === "preset" ? (
        <link
          rel="stylesheet"
          href={`${PRESET_FONTS_HREF}?v=${ASSET_VERSION}`}
        />
      ) : null}
      {css ? <style data-vb-font={font.mode}>{css}</style> : null}
    </>
  );
}
