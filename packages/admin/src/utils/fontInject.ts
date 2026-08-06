// 后台字体注入公共逻辑：供「字体设置」页预览与全局编辑器预览注入（FontSync）共用。
// 与前台 packages/website/components/FontStyle/index.tsx 的注册表/构造逻辑保持一致（镜像一份，跨包不便直接 import）。

export interface AdminFontDef {
  value: string;
  label: string;
  family: string | null;
  href?: string;
}

export interface AdminFontSetting {
  mode?: 'off' | 'preset' | 'custom';
  scope?: 'body' | 'site';
  cnFont?: string;
  enFont?: string;
  fontFamily?: string;
  faces?: Array<{
    family?: string;
    src?: string;
    weight?: string;
    style?: string;
    format?: string;
  }>;
}

export const CN_FONTS: AdminFontDef[] = [
  { value: 'system', label: '系统默认（不下载）', family: null },
  { value: 'lxgw', label: '霞鹜文楷', family: 'LXGW WenKai', href: '/fonts/preset/lxgw/index.css' },
  { value: 'misans', label: 'MiSans（近苹方）', family: 'MiSans', href: '/fonts/preset/misans/index.css' },
  { value: 'songti', label: '思源宋体', family: 'Source Han Serif SC', href: '/fonts/preset/songti/index.css' },
];

export const EN_FONTS: AdminFontDef[] = [
  { value: 'system', label: '系统默认（不下载）', family: null },
  { value: 'ebgaramond', label: 'EB Garamond', family: 'EB Garamond', href: '/fonts/preset/ebg/index.css' },
  { value: 'inter', label: 'Inter', family: 'Inter', href: '/fonts/preset/inter/index.css' },
  { value: 'jetbrains', label: 'JetBrains Mono', family: 'JetBrains Mono', href: '/fonts/preset/jetbrains/index.css' },
];

export const SYSTEM_FALLBACK =
  '"PingFang SC", "Microsoft YaHei", -apple-system, system-ui, sans-serif';

// 表单控件还原用的系统 UI 字体栈（与前台一致）
export const UI_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

export const findFont = (list: AdminFontDef[], value?: string): AdminFontDef =>
  list.find((f) => f.value === value) || list[0];

const escapeCss = (v: string): string => (v || '').replace(/[<>{}]/g, '');

// preset 模式下需要按需加载的 @font-face 表 href（仅选中的字体，system 不加载）
export function getPresetHrefs(font: AdminFontSetting): string[] {
  if (!font || font.mode !== 'preset') return [];
  const hrefs: string[] = [];
  const en = findFont(EN_FONTS, font.enFont).href;
  const cn = findFont(CN_FONTS, font.cnFont).href;
  if (en) hrefs.push(en);
  if (cn) hrefs.push(cn);
  return hrefs;
}

// custom 模式的 @font-face CSS（src 指向 /static/font/...）
export function buildFaceCss(font: AdminFontSetting): string {
  if (!font || font.mode !== 'custom') return '';
  const faces = Array.isArray(font.faces) ? font.faces : [];
  return faces
    .filter((f) => f && f.family && f.src)
    .map((f) => {
      const family = escapeCss(f.family as string);
      const src = (f.src as string).replace(/["\\]/g, '');
      const format = f.format ? ` format("${escapeCss(f.format)}")` : '';
      return `@font-face{font-family:"${family}";src:url("${src}")${format};font-weight:${
        escapeCss(f.weight || 'normal')
      };font-style:${escapeCss(f.style || 'normal')};font-display:swap;}`;
    })
    .join('\n');
}

// 计算 font-family 栈：preset → 英文在前中文在后 + 系统回退；custom → 用户填写的栈。
// 两侧都 system（preset）或未填（custom）返回空字符串（表示不覆盖）。
export function buildFontFamily(font: AdminFontSetting): string {
  if (!font || font.mode === 'off') return '';
  if (font.mode === 'preset') {
    const en = findFont(EN_FONTS, font.enFont).family;
    const cn = findFont(CN_FONTS, font.cnFont).family;
    const parts: string[] = [];
    if (en) parts.push(`"${en}"`);
    if (cn) parts.push(`"${cn}"`);
    if (!parts.length) return '';
    return `${parts.join(', ')}, ${SYSTEM_FALLBACK}`;
  }
  // custom
  return escapeCss((font.fontFamily || '').trim());
}

// 给指定作用域生成完整的字体 CSS（@font-face + font-family 规则 + 表单控件还原）。
// admin 编辑器预览容器固定为 .markdown-body，因此 selector 传 'html .markdown-body'。
export function buildScopedFontCss(font: AdminFontSetting, selector: string): string {
  if (!font || font.mode === 'off') return '';
  const family = buildFontFamily(font);
  const faceCss = buildFaceCss(font);
  if (!family && !faceCss) return '';
  const rules: string[] = [];
  if (faceCss) rules.push(faceCss);
  if (family) {
    rules.push(`${selector} { font-family: ${family} !important; }`);
    rules.push(
      `${selector} :is(button, input, select, textarea) { font-family: ${UI_FONT_STACK} !important; }`,
    );
  }
  return rules.join('\n');
}
