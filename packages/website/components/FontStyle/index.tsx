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

// 系统 UI 字体栈：内容区内的表单控件（按钮/输入/下拉/文本域）还原用，
// 让"点"的 UI 保持系统字体，只有"读"的内容套自定义字体。
const UI_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

// 内容根：body → 文章相关内容区 .vanblog-main（排除导航/侧栏/页脚/搜索）；site → 全站 body。
function contentRoot(scope: "body" | "site"): string {
  return scope === "site" ? "html body" : "html .vanblog-main";
}

// 主字体规则的选择器：内容根 + 正文容器 .markdown-body。
// .markdown-body 在 github-markdown.css 里有自己的 font-family（直接命中该元素），
// 仅靠内容根的继承会被它截断，所以必须把 .markdown-body 一起显式命中压过。
function fontFamilySelector(scope: "body" | "site"): string {
  return `${contentRoot(scope)}, html .markdown-body`;
}

// Tailwind preflight 给 button/input/select/textarea 设了 font-family:inherit，
// 扩大作用域后这些控件会继承正文字体；这里把内容根内的它们还原成系统 UI 字体。
function controlResetRule(scope: "body" | "site"): string {
  return `${contentRoot(scope)} :is(button, input, select, textarea) { font-family: ${UI_FONT_STACK} !important; }`;
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
  const scope = font.scope || "body";
  const selector = fontFamilySelector(scope);

  if (font.mode === "preset") {
    const stack = presetFontFamily(font);
    if (!stack) return "";
    return `${selector} { font-family: ${stack} !important; }\n${controlResetRule(scope)}`;
  }

  // custom
  const faces = Array.isArray(font.faces) ? font.faces : [];
  const faceCss = faces.map(buildFaceCss).filter(Boolean).join("\n");
  const stack = (font.fontFamily || "").trim();
  const familyRule = stack
    ? `${selector} { font-family: ${escapeFontFamily(stack)} !important; }\n${controlResetRule(scope)}`
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
        // precedence 让 React 19 把样式表当作可提升资源：跨 SSR/hydration 按 href 去重并
        // 提升到 <head>，避免服务端渲染在 head、客户端又在 body 各插一份的重复问题。
        <link
          key={href}
          rel="stylesheet"
          href={`${href}?v=${ASSET_VERSION}`}
          precedence="vanblog-font"
        />
      ))}
      {css ? (
        // <style> 需同时带 href(去重键) + precedence，React 19 才会去重并提升。
        <style
          href={`vanblog-font-${font.mode}-${font.scope || "body"}`}
          precedence="vanblog-font"
          data-vb-font={font.mode}
        >
          {css}
        </style>
      ) : null}
    </>
  );
}
