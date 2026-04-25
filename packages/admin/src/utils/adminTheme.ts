export interface AdminThemeConfig {
  lightPrimaryColor: string;
  darkPrimaryColor: string;
  lightBackgroundColor: string;
  darkBackgroundColor: string;
}

export type AdminDarkThemePresetKey = 'graphite' | 'warm-ink' | 'slate-metal';

export interface AdminDarkThemePreset {
  key: AdminDarkThemePresetKey;
  label: string;
  description: string;
  darkPrimaryColor: string;
  darkBackgroundColor: string;
}

export const ADMIN_THEME_STORAGE_KEY = 'vanblog.admin.theme.config';

const LEGACY_ADMIN_THEME_CONFIG: AdminThemeConfig = {
  lightPrimaryColor: '#1772b4',
  darkPrimaryColor: '#60a5fa',
  lightBackgroundColor: '#f4f8fb',
  darkBackgroundColor: '#111827',
};

export const DEFAULT_ADMIN_THEME_CONFIG: AdminThemeConfig = {
  lightPrimaryColor: '#1772b4',
  darkPrimaryColor: '#8d9bb0',
  lightBackgroundColor: '#f4f8fb',
  darkBackgroundColor: '#111315',
};

export const ADMIN_DARK_THEME_PRESETS: AdminDarkThemePreset[] = [
  {
    key: 'graphite',
    label: '炭黑石墨',
    description: '近黑石墨底色，低饱和钢蓝强调，整体最稳。',
    darkPrimaryColor: '#8d9bb0',
    darkBackgroundColor: '#111315',
  },
  {
    key: 'warm-ink',
    label: '暖黑墨色',
    description: '更柔和的墨色黑底，带一点暖灰质感。',
    darkPrimaryColor: '#a28f7d',
    darkBackgroundColor: '#151210',
  },
  {
    key: 'slate-metal',
    label: '冷黑金属',
    description: '冷灰黑金属感，边缘更利落。',
    darkPrimaryColor: '#8b97a6',
    darkBackgroundColor: '#101418',
  },
];

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CUSTOM_ADMIN_DARK_PRESET = '__custom__';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHexColor = (value: unknown, fallback: string) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (HEX_COLOR_PATTERN.test(normalized)) {
    return normalized;
  }

  return fallback;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHexColor(value, '');
  if (!normalized) {
    return null;
  }

  const numeric = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }) =>
  `#${[rgb.r, rgb.g, rgb.b]
    .map((item) => clamp(Math.round(item), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;

const mixHexColors = (base: string, overlay: string, weight: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) {
    return normalizeHexColor(base, overlay);
  }

  const ratio = clamp(weight, 0, 1);
  return rgbToHex({
    r: baseRgb.r + (overlayRgb.r - baseRgb.r) * ratio,
    g: baseRgb.g + (overlayRgb.g - baseRgb.g) * ratio,
    b: baseRgb.b + (overlayRgb.b - baseRgb.b) * ratio,
  });
};

const toRgba = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return value;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const isSameAdminThemeConfig = (left: AdminThemeConfig, right: AdminThemeConfig) =>
  left.lightPrimaryColor === right.lightPrimaryColor &&
  left.darkPrimaryColor === right.darkPrimaryColor &&
  left.lightBackgroundColor === right.lightBackgroundColor &&
  left.darkBackgroundColor === right.darkBackgroundColor;

const maybeUpgradeLegacyAdminThemeConfig = (config: AdminThemeConfig) =>
  isSameAdminThemeConfig(config, LEGACY_ADMIN_THEME_CONFIG) ? DEFAULT_ADMIN_THEME_CONFIG : config;

export const normalizeAdminThemeConfig = (
  value?: Partial<AdminThemeConfig> | null,
): AdminThemeConfig => {
  const normalized = {
    lightPrimaryColor: normalizeHexColor(
      value?.lightPrimaryColor,
      DEFAULT_ADMIN_THEME_CONFIG.lightPrimaryColor,
    ),
    darkPrimaryColor: normalizeHexColor(
      value?.darkPrimaryColor,
      DEFAULT_ADMIN_THEME_CONFIG.darkPrimaryColor,
    ),
    lightBackgroundColor: normalizeHexColor(
      value?.lightBackgroundColor,
      DEFAULT_ADMIN_THEME_CONFIG.lightBackgroundColor,
    ),
    darkBackgroundColor: normalizeHexColor(
      value?.darkBackgroundColor,
      DEFAULT_ADMIN_THEME_CONFIG.darkBackgroundColor,
    ),
  };

  return maybeUpgradeLegacyAdminThemeConfig(normalized);
};

export const getAdminDarkThemePresetValue = (value?: Partial<AdminThemeConfig> | null) => {
  const config = normalizeAdminThemeConfig(value);
  const matchedPreset = ADMIN_DARK_THEME_PRESETS.find(
    (preset) =>
      preset.darkBackgroundColor === config.darkBackgroundColor &&
      preset.darkPrimaryColor === config.darkPrimaryColor,
  );

  return matchedPreset?.key || CUSTOM_ADMIN_DARK_PRESET;
};

export const getAdminDarkThemePresetOptions = () => [
  ...ADMIN_DARK_THEME_PRESETS.map((preset) => ({
    value: preset.key,
    label: preset.label,
    description: preset.description,
  })),
  {
    value: CUSTOM_ADMIN_DARK_PRESET,
    label: '高级自定义',
    description: '使用下面的颜色输入框手动搭配。',
  },
];

export const getAdminDarkThemePresetConfig = (presetKey?: string | null) => {
  const matchedPreset = ADMIN_DARK_THEME_PRESETS.find((preset) => preset.key === presetKey);
  if (!matchedPreset) {
    return null;
  }

  return {
    darkPrimaryColor: matchedPreset.darkPrimaryColor,
    darkBackgroundColor: matchedPreset.darkBackgroundColor,
  };
};

export const resolveAdminThemeMode = (theme?: string | null) =>
  theme === 'dark' || theme === 'realDark' ? 'dark' : 'light';

export const getAdminPrimaryColor = (
  theme: string | null | undefined,
  value?: Partial<AdminThemeConfig> | null,
) => {
  const config = normalizeAdminThemeConfig(value);
  return resolveAdminThemeMode(theme) === 'dark'
    ? config.darkPrimaryColor
    : config.lightPrimaryColor;
};

export const getAdminBackgroundColor = (
  theme: string | null | undefined,
  value?: Partial<AdminThemeConfig> | null,
) => {
  const config = normalizeAdminThemeConfig(value);
  return resolveAdminThemeMode(theme) === 'dark'
    ? config.darkBackgroundColor
    : config.lightBackgroundColor;
};

const createCssVariableMap = (theme: string, value?: Partial<AdminThemeConfig> | null) => {
  const themeMode = resolveAdminThemeMode(theme);
  const config = normalizeAdminThemeConfig(value);
  const primaryColor = getAdminPrimaryColor(themeMode, config);
  const backgroundColor = getAdminBackgroundColor(themeMode, config);
  const isDark = themeMode === 'dark';

  const surfaceBg = isDark ? backgroundColor : mixHexColors(backgroundColor, '#ffffff', 0.72);
  const surfaceBgSubtle = isDark
    ? backgroundColor
    : mixHexColors(backgroundColor, primaryColor, 0.05);
  const surfaceBgElevated = isDark ? backgroundColor : '#ffffff';
  const siderBg = isDark ? backgroundColor : mixHexColors(backgroundColor, '#ffffff', 0.82);
  const tableHeaderBg = isDark
    ? backgroundColor
    : mixHexColors(backgroundColor, primaryColor, 0.08);
  const appBackground = isDark ? backgroundColor : mixHexColors(backgroundColor, '#ffffff', 0.35);
  const documentBase = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.025)
    : mixHexColors(backgroundColor, '#ffffff', 0.92);
  const documentTreeBg = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.04)
    : mixHexColors(backgroundColor, '#ffffff', 0.9);
  const documentEditorBg = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.03) : '#ffffff';
  const documentPreviewBgSoft = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.055)
    : '#eef6ff';
  const documentPreviewBg = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.035) : '#f8fafc';
  const documentToolbarBg = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.045)
    : mixHexColors(backgroundColor, '#ffffff', 0.96);
  const documentScrollTrack = isDark ? toRgba('#ffffff', 0.04) : '#f1f5f9';
  const documentScrollThumb = isDark ? toRgba('#ffffff', 0.14) : '#c1c9d4';
  const documentCodeBtnText = isDark ? '#bcc4cd' : '#6f7177';
  const documentCodeBtnHover = isDark ? toRgba('#ffffff', 0.06) : 'rgb(229 231 235)';
  const documentCodeFade = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.03) : '#f6f8fa';
  const editorCanvasBg = isDark ? backgroundColor : '#ffffff';
  const editorBg = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.025) : '#ffffff';
  const editorPanelBg = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.04)
    : mixHexColors(backgroundColor, '#ffffff', 0.98);
  const editorPanelBgAlt = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.055)
    : mixHexColors(backgroundColor, primaryColor, 0.05);
  const editorPreviewBg = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.035) : '#f8fafc';
  const editorBorder = isDark ? toRgba('#ffffff', 0.07) : 'rgba(15, 23, 42, 0.08)';
  const editorBorderStrong = isDark ? toRgba('#ffffff', 0.1) : toRgba(primaryColor, 0.18);
  const editorText = isDark ? '#eceff4' : '#0f172a';
  const editorMuted = isDark ? '#bcc4cd' : '#52637a';
  const editorSubtle = isDark ? '#9098a2' : '#7b8794';
  const editorAccent = primaryColor;
  const editorAccentStrong = isDark
    ? mixHexColors(primaryColor, '#ffffff', 0.08)
    : mixHexColors(primaryColor, '#0f172a', 0.08);
  const editorHover = isDark ? toRgba('#ffffff', 0.05) : toRgba(primaryColor, 0.08);
  const editorActive = isDark ? toRgba('#ffffff', 0.08) : toRgba(primaryColor, 0.14);
  const editorSelection = toRgba(primaryColor, isDark ? 0.16 : 0.14);
  const editorShadow = isDark
    ? '0 14px 36px rgba(0, 0, 0, 0.18)'
    : `0 18px 42px ${toRgba(primaryColor, 0.12)}`;
  const editorMermaidBg = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.035) : '#eef7ff';
  const editorMermaidBorder = isDark ? toRgba('#ffffff', 0.08) : '#d6e7f7';
  const editorMermaidText = isDark ? '#d6dde6' : '#0f4f8a';
  const authBackground = isDark
    ? `linear-gradient(180deg, ${mixHexColors(
        backgroundColor,
        '#191c20',
        0.08,
      )} 0%, ${backgroundColor} 100%)`
    : `radial-gradient(circle at top, ${toRgba(
        primaryColor,
        0.14,
      )}, transparent 40%), radial-gradient(circle at bottom right, ${toRgba(
        primaryColor,
        0.08,
      )}, transparent 34%), linear-gradient(180deg, ${mixHexColors(
        backgroundColor,
        '#ffffff',
        0.52,
      )} 0%, ${backgroundColor} 54%, ${mixHexColors(backgroundColor, '#ffffff', 0.7)} 100%)`;

  return {
    '--admin-primary': primaryColor,
    '--admin-primary-soft-bg': isDark ? 'transparent' : toRgba(primaryColor, 0.1),
    '--admin-primary-soft-hover': isDark ? 'transparent' : toRgba(primaryColor, 0.16),
    '--admin-primary-soft-active': isDark ? 'transparent' : toRgba(primaryColor, 0.22),
    '--admin-primary-soft-border': isDark ? 'transparent' : toRgba(primaryColor, 0.2),
    '--admin-primary-strong-shadow': isDark ? 'transparent' : toRgba(primaryColor, 0.22),
    '--admin-primary-text': primaryColor,
    '--admin-primary-link': primaryColor,
    '--admin-app-background': appBackground,
    '--admin-auth-background': authBackground,
    '--admin-auth-panel-bg': isDark ? backgroundColor : 'rgba(255, 255, 255, 0.88)',
    '--admin-auth-panel-border': isDark ? 'transparent' : toRgba(primaryColor, 0.16),
    '--admin-auth-panel-shadow': isDark
      ? 'none'
      : `0 24px 72px ${toRgba(primaryColor, 0.16)}, 0 0 0 1px rgba(255, 255, 255, 0.55)`,
    '--admin-auth-text': isDark ? '#eceff4' : '#0f172a',
    '--admin-auth-text-secondary': isDark ? '#a5adb7' : '#52637a',
    '--admin-auth-input-bg': isDark ? backgroundColor : 'rgba(255, 255, 255, 0.92)',
    '--admin-auth-input-border': isDark ? 'transparent' : toRgba(primaryColor, 0.16),
    '--admin-auth-link': primaryColor,
    '--admin-loading-color': primaryColor,
    '--admin-surface-bg': surfaceBg,
    '--admin-surface-bg-subtle': surfaceBgSubtle,
    '--admin-surface-bg-elevated': surfaceBgElevated,
    '--admin-surface-border': isDark ? 'transparent' : 'rgba(5, 5, 5, 0.06)',
    '--admin-document-tree-bg': documentTreeBg,
    '--admin-document-editor-bg': documentEditorBg,
    '--admin-document-preview-bg-soft': documentPreviewBgSoft,
    '--admin-document-preview-bg': documentPreviewBg,
    '--admin-document-toolbar-bg': documentToolbarBg,
    '--admin-document-scroll-track': documentScrollTrack,
    '--admin-document-scroll-thumb': documentScrollThumb,
    '--admin-document-code-btn-text': documentCodeBtnText,
    '--admin-document-code-btn-hover': documentCodeBtnHover,
    '--admin-document-code-fade': documentCodeFade,
    '--admin-document-divider': isDark ? toRgba('#ffffff', 0.06) : 'rgba(5, 5, 5, 0.06)',
    '--admin-editor-canvas-bg': editorCanvasBg,
    '--admin-editor-bg': editorBg,
    '--admin-editor-panel-bg': editorPanelBg,
    '--admin-editor-panel-bg-alt': editorPanelBgAlt,
    '--admin-editor-preview-bg': editorPreviewBg,
    '--admin-editor-border': editorBorder,
    '--admin-editor-border-strong': editorBorderStrong,
    '--admin-editor-text': editorText,
    '--admin-editor-muted': editorMuted,
    '--admin-editor-subtle': editorSubtle,
    '--admin-editor-accent': editorAccent,
    '--admin-editor-accent-strong': editorAccentStrong,
    '--admin-editor-hover': editorHover,
    '--admin-editor-active': editorActive,
    '--admin-editor-selection': editorSelection,
    '--admin-editor-shadow': editorShadow,
    '--admin-editor-mermaid-bg': editorMermaidBg,
    '--admin-editor-mermaid-border': editorMermaidBorder,
    '--admin-editor-mermaid-text': editorMermaidText,
    '--admin-modal-bg': surfaceBg,
    '--admin-modal-bg-subtle': surfaceBgSubtle,
    '--admin-modal-border': isDark ? 'transparent' : 'rgba(5, 5, 5, 0.08)',
    '--admin-modal-text': isDark ? '#eceff4' : '#0f172a',
    '--admin-modal-text-secondary': isDark ? '#a5adb7' : '#52637a',
    '--admin-modal-warning-bg': isDark ? backgroundColor : 'rgba(245, 158, 11, 0.14)',
    '--admin-modal-warning-text': isDark ? '#eceff4' : '#b45309',
    '--admin-overlay-mask': isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.18)',
    '--admin-sider-bg': siderBg,
    '--admin-sider-text': isDark ? '#bcc4cd' : 'rgba(0, 0, 0, 0.65)',
    '--admin-sider-secondary-text': isDark ? '#98a1ab' : 'rgba(0, 0, 0, 0.45)',
    '--admin-sider-strong-text': isDark ? '#f2f4f7' : 'rgba(0, 0, 0, 0.88)',
    '--admin-sider-hover-bg': isDark ? 'transparent' : toRgba(primaryColor, 0.08),
    '--admin-sider-selected-bg': isDark ? 'transparent' : toRgba(primaryColor, 0.12),
    '--admin-sider-selected-text': isDark ? primaryColor : primaryColor,
    '--admin-sider-border': isDark ? 'transparent' : 'rgba(5, 5, 5, 0.06)',
    '--admin-table-header-bg': tableHeaderBg,
  };
};

export const getAdminLayoutToken = (
  theme: string | null | undefined,
  value?: Partial<AdminThemeConfig> | null,
) => {
  const themeMode = resolveAdminThemeMode(theme);
  const primaryColor = getAdminPrimaryColor(themeMode, value);
  const backgroundColor = getAdminBackgroundColor(themeMode, value);
  const isDark = themeMode === 'dark';
  const siderBg = isDark ? backgroundColor : mixHexColors(backgroundColor, '#ffffff', 0.82);

  return {
    layout: {
      sider: {
        colorMenuBackground: siderBg,
        colorBgCollapsedButton: siderBg,
        colorTextCollapsedButton: isDark ? '#bcc4cd' : 'rgba(0, 0, 0, 0.65)',
        colorTextCollapsedButtonHover: isDark ? primaryColor : 'rgba(0, 0, 0, 0.88)',
        colorMenuItemDivider: isDark ? 'transparent' : 'rgba(5, 5, 5, 0.06)',
        colorTextMenu: isDark ? '#bcc4cd' : 'rgba(0, 0, 0, 0.65)',
        colorTextMenuSecondary: isDark ? '#98a1ab' : 'rgba(0, 0, 0, 0.45)',
        colorTextMenuTitle: isDark ? '#f2f4f7' : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuItemHover: isDark ? primaryColor : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuActive: isDark ? primaryColor : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuSelected: isDark ? primaryColor : primaryColor,
        colorBgMenuItemHover: isDark ? 'transparent' : toRgba(primaryColor, 0.08),
        colorBgMenuItemSelected: isDark ? 'transparent' : toRgba(primaryColor, 0.12),
      },
    },
  };
};

const ensureThemeColorMeta = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  let meta = document.head.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }

  return meta;
};

export const readStoredAdminThemeConfig = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_THEME_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ADMIN_THEME_CONFIG;
    }
    return normalizeAdminThemeConfig(JSON.parse(raw));
  } catch (error) {
    return DEFAULT_ADMIN_THEME_CONFIG;
  }
};

export const storeAdminThemeConfig = (value?: Partial<AdminThemeConfig> | null) => {
  const config = normalizeAdminThemeConfig(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, JSON.stringify(config));
  }
  return config;
};

export const applyAdminTheme = (
  theme: string | null | undefined,
  value?: Partial<AdminThemeConfig> | null,
  options?: { persist?: boolean },
) => {
  const config = normalizeAdminThemeConfig(value || readStoredAdminThemeConfig());
  const cssVariables = createCssVariableMap(theme || 'light', config);
  const primaryColor = getAdminPrimaryColor(theme, config);

  if (options?.persist !== false) {
    storeAdminThemeConfig(config);
  }

  if (typeof document !== 'undefined') {
    Object.entries(cssVariables).forEach(([key, currentValue]) => {
      document.documentElement.style.setProperty(key, currentValue);
    });

    const meta = ensureThemeColorMeta();
    if (meta) {
      meta.setAttribute('content', primaryColor);
    }
  }

  return config;
};
