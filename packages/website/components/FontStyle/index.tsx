import React from "react";
import type { FontSettingProp } from "../../api/getAllData";

// 内置字体注册表（与后台 Font 设置页的选项保持一致）。
// family 为 null 表示"系统默认，不下载"；href 为该字体子集化后的 @font-face 表。
export interface PresetFontDef {
  label: string;
  family: string | null;
  href?: string;
}

export const PRESET_CN_FONTS: Record<string, PresetFontDef> = {
  system: { label: "系统默认", family: null },
  lxgw: { label: "霞鹜文楷", family: "LXGW WenKai", href: "/fonts/preset/lxgw/index.css" },
  misans: { label: "MiSans（近苹方）", family: "MiSans", href: "/fonts/preset/misans/index.css" },
  songti: {
    label: "思源宋体",
    family: "Source Han Serif SC",
    href: "/fonts/preset/songti/index.css",
  },
};

export const PRESET_EN_FONTS: Record<string, PresetFontDef> = {
  system: { label: "系统默认", family: null },
  ebgaramond: {
    label: "EB Garamond",
    family: "EB Garamond",
    href: "/fonts/preset/ebg/index.css",
  },
  inter: { label: "Inter", family: "Inter", href: "/fonts/preset/inter/index.css" },
  jetbrains: {
    label: "JetBrains Mono",
    family: "JetBrains Mono",
    href: "/fonts/preset/jetbrains/index.css",
  },
};

// 系统回退栈（英文/中文都留"系统默认"时，即维持博客原本的字体观感）
const SYSTEM_FALLBACK =
  '"PingFang SC", "Microsoft YaHei", -apple-system, system-ui, "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';

// 作用域：body → 仅正文（html 前缀提高优先级压过 markdown 主题 CSS）；site → 全站
function scopeSelector(scope: "body" | "site"): string {
  return scope === "site" ? "body" : "html .markdown-body";
}

function escapeFontFamily(value: string): string {
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

// 预设模式：英文字体在前、中文字体在后（逐字形回退实现"英文用 A、中文用 B"），
// 未选（system）的一侧自动回退到系统字体。
function presetFontFamily(font: FontSettingProp): string {
  const en = PRESET_EN_FONTS[font.enFont || "system"]?.family;
  const cn = PRESET_CN_FONTS[font.cnFont || "system"]?.family;
  const parts: string[] = [];
  if (en) parts.push(`"${en}"`);
  if (cn) parts.push(`"${cn}"`);
  if (!parts.length) return ""; // 两侧都系统默认 → 不注入
  return `${parts.join(", ")}, ${SYSTEM_FALLBACK}`;
}

export function buildFontCss(font?: FontSettingProp): string {
  if (!font || font.mode === "off") return "";
  const selector = scopeSelector(font.scope || "body");

  if (font.mode === "preset") {
    const stack = presetFontFamily(font);
    return stack ? `${selector} { font-family: ${stack} !important; }` : "";
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

// 预设模式下需要按需加载的 @font-face 表（仅选中的字体，system 不加载）
function presetHrefs(font: FontSettingProp): string[] {
  const hrefs: string[] = [];
  const en = PRESET_EN_FONTS[font.enFont || "system"]?.href;
  const cn = PRESET_CN_FONTS[font.cnFont || "system"]?.href;
  if (en) hrefs.push(en);
  if (cn) hrefs.push(cn);
  return hrefs;
}

const ASSET_VERSION =
  process.env.NEXT_PUBLIC_MARKDOWN_THEME_ASSET_VERSION || "dev";

export default function FontStyle(props: { font?: FontSettingProp }) {
  const font = props.font;
  if (!font || font.mode === "off") return null;

  const css = buildFontCss(font);
  const hrefs = font.mode === "preset" ? presetHrefs(font) : [];
  if (!css && !hrefs.length) return null;

  return (
    <>
      {hrefs.map((href) => (
        <link key={href} rel="stylesheet" href={`${href}?v=${ASSET_VERSION}`} />
      ))}
      {css ? <style data-vb-font={font.mode}>{css}</style> : null}
    </>
  );
}
