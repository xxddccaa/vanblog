export interface AdminThemeConfig {
  lightPrimaryColor: string;
  darkPrimaryColor: string;
  lightBackgroundColor: string;
  darkBackgroundColor: string;
}

export const ADMIN_THEME_STORAGE_KEY = 'vanblog.admin.theme.config';
export const DEFAULT_ADMIN_THEME_CONFIG: AdminThemeConfig = {
  lightPrimaryColor: '#1772b4',
  darkPrimaryColor: '#60a5fa',
  lightBackgroundColor: '#f4f8fb',
  darkBackgroundColor: '#111827',
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

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

export const normalizeAdminThemeConfig = (
  value?: Partial<AdminThemeConfig> | null,
): AdminThemeConfig => ({
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
});

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

  const surfaceBg = isDark
    ? mixHexColors(backgroundColor, primaryColor, 0.08)
    : mixHexColors(backgroundColor, '#ffffff', 0.72);
  const surfaceBgSubtle = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.05)
    : mixHexColors(backgroundColor, primaryColor, 0.05);
  const surfaceBgElevated = isDark ? mixHexColors(backgroundColor, '#ffffff', 0.08) : '#ffffff';
  const siderBg = isDark
    ? mixHexColors(backgroundColor, primaryColor, 0.12)
    : mixHexColors(backgroundColor, '#ffffff', 0.82);
  const tableHeaderBg = isDark
    ? mixHexColors(backgroundColor, '#ffffff', 0.08)
    : mixHexColors(backgroundColor, primaryColor, 0.08);
  const appBackground = isDark ? backgroundColor : mixHexColors(backgroundColor, '#ffffff', 0.35);
  const documentBase = isDark
    ? mixHexColors(backgroundColor, '#020617', 0.26)
    : mixHexColors(backgroundColor, '#ffffff', 0.92);
  const documentTreeBg = isDark
    ? mixHexColors(documentBase, '#ffffff', 0.06)
    : mixHexColors(backgroundColor, '#ffffff', 0.9);
  const documentEditorBg = isDark ? mixHexColors(documentBase, '#020617', 0.1) : '#ffffff';
  const documentPreviewBgSoft = isDark ? mixHexColors(documentBase, primaryColor, 0.06) : '#eef6ff';
  const documentPreviewBg = isDark ? mixHexColors(documentBase, '#ffffff', 0.04) : '#f8fafc';
  const documentToolbarBg = isDark
    ? mixHexColors(documentBase, '#ffffff', 0.08)
    : mixHexColors(backgroundColor, '#ffffff', 0.96);
  const documentScrollTrack = isDark ? mixHexColors(documentBase, '#000000', 0.12) : '#f1f5f9';
  const documentScrollThumb = isDark ? toRgba(primaryColor, 0.34) : '#c1c9d4';
  const documentCodeBtnText = isDark ? '#c9dbef' : '#6f7177';
  const documentCodeBtnHover = isDark ? toRgba(primaryColor, 0.14) : 'rgb(229 231 235)';
  const documentCodeFade = isDark ? documentPreviewBg : '#f6f8fa';
  const editorCanvasBg = isDark ? mixHexColors(backgroundColor, '#020617', 0.42) : '#ffffff';
  const editorBg = isDark ? mixHexColors(editorCanvasBg, primaryColor, 0.05) : '#ffffff';
  const editorPanelBg = isDark
    ? mixHexColors(editorCanvasBg, '#ffffff', 0.06)
    : mixHexColors(backgroundColor, '#ffffff', 0.98);
  const editorPanelBgAlt = isDark
    ? mixHexColors(editorCanvasBg, primaryColor, 0.04)
    : mixHexColors(backgroundColor, primaryColor, 0.05);
  const editorPreviewBg = isDark ? mixHexColors(editorCanvasBg, '#ffffff', 0.04) : '#f8fafc';
  const editorBorder = isDark ? toRgba(primaryColor, 0.18) : 'rgba(15, 23, 42, 0.08)';
  const editorBorderStrong = isDark ? toRgba(primaryColor, 0.3) : toRgba(primaryColor, 0.18);
  const editorText = isDark ? '#e9f3ff' : '#0f172a';
  const editorMuted = isDark ? '#bdd1e8' : '#52637a';
  const editorSubtle = isDark ? '#8da7c5' : '#7b8794';
  const editorAccent = isDark ? mixHexColors(primaryColor, '#ffffff', 0.16) : primaryColor;
  const editorAccentStrong = isDark
    ? mixHexColors(primaryColor, '#ffffff', 0.06)
    : mixHexColors(primaryColor, '#0f172a', 0.08);
  const editorHover = toRgba(primaryColor, isDark ? 0.12 : 0.08);
  const editorActive = toRgba(primaryColor, isDark ? 0.18 : 0.14);
  const editorSelection = toRgba(primaryColor, isDark ? 0.18 : 0.14);
  const editorShadow = isDark
    ? `0 20px 54px ${toRgba(mixHexColors(editorCanvasBg, '#000000', 0.28), 0.42)}`
    : `0 18px 42px ${toRgba(primaryColor, 0.12)}`;
  const editorMermaidBg = '#eef7ff';
  const editorMermaidBorder = isDark ? toRgba(primaryColor, 0.3) : '#d6e7f7';
  const editorMermaidText = '#0f4f8a';
  const authBackground = isDark
    ? `radial-gradient(circle at top, ${toRgba(
        primaryColor,
        0.22,
      )}, transparent 42%), radial-gradient(circle at bottom right, ${toRgba(
        primaryColor,
        0.14,
      )}, transparent 34%), linear-gradient(180deg, ${mixHexColors(
        backgroundColor,
        primaryColor,
        0.12,
      )} 0%, ${backgroundColor} 52%, ${mixHexColors(backgroundColor, '#000000', 0.18)} 100%)`
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
    '--admin-primary-soft-bg': toRgba(primaryColor, isDark ? 0.18 : 0.1),
    '--admin-primary-soft-hover': toRgba(primaryColor, isDark ? 0.24 : 0.16),
    '--admin-primary-soft-active': toRgba(primaryColor, isDark ? 0.32 : 0.22),
    '--admin-primary-soft-border': toRgba(primaryColor, isDark ? 0.32 : 0.2),
    '--admin-primary-strong-shadow': toRgba(primaryColor, isDark ? 0.34 : 0.22),
    '--admin-primary-text': isDark ? '#f8fafc' : primaryColor,
    '--admin-primary-link': isDark ? '#d8ebff' : primaryColor,
    '--admin-app-background': appBackground,
    '--admin-auth-background': authBackground,
    '--admin-auth-panel-bg': isDark ? toRgba(surfaceBgElevated, 0.9) : 'rgba(255, 255, 255, 0.88)',
    '--admin-auth-panel-border': toRgba(primaryColor, isDark ? 0.28 : 0.16),
    '--admin-auth-panel-shadow': isDark
      ? `0 24px 80px rgba(2, 8, 23, 0.54), 0 0 0 1px ${toRgba(primaryColor, 0.08)}`
      : `0 24px 72px ${toRgba(primaryColor, 0.16)}, 0 0 0 1px rgba(255, 255, 255, 0.55)`,
    '--admin-auth-text': isDark ? '#e8f3ff' : '#0f172a',
    '--admin-auth-text-secondary': isDark ? '#a4bed8' : '#52637a',
    '--admin-auth-input-bg': isDark ? toRgba(surfaceBg, 0.82) : 'rgba(255, 255, 255, 0.92)',
    '--admin-auth-input-border': toRgba(primaryColor, isDark ? 0.24 : 0.16),
    '--admin-auth-link': isDark ? '#d3ebff' : primaryColor,
    '--admin-loading-color': primaryColor,
    '--admin-surface-bg': surfaceBg,
    '--admin-surface-bg-subtle': surfaceBgSubtle,
    '--admin-surface-bg-elevated': surfaceBgElevated,
    '--admin-surface-border': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(5, 5, 5, 0.06)',
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
    '--admin-document-divider': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(5, 5, 5, 0.06)',
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
    '--admin-modal-border': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(5, 5, 5, 0.08)',
    '--admin-modal-text': isDark ? '#e5e7eb' : '#0f172a',
    '--admin-modal-text-secondary': isDark ? '#cbd5e1' : '#52637a',
    '--admin-modal-warning-bg': isDark ? 'rgba(217, 119, 6, 0.14)' : 'rgba(245, 158, 11, 0.14)',
    '--admin-modal-warning-text': isDark ? '#fbbf24' : '#b45309',
    '--admin-overlay-mask': isDark ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.18)',
    '--admin-sider-bg': siderBg,
    '--admin-sider-text': isDark ? '#cbd5e1' : 'rgba(0, 0, 0, 0.65)',
    '--admin-sider-secondary-text': isDark ? '#cbd5e1' : 'rgba(0, 0, 0, 0.45)',
    '--admin-sider-strong-text': isDark ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)',
    '--admin-sider-hover-bg': toRgba(primaryColor, isDark ? 0.18 : 0.08),
    '--admin-sider-selected-bg': toRgba(primaryColor, isDark ? 0.24 : 0.12),
    '--admin-sider-selected-text': isDark ? '#f8fafc' : primaryColor,
    '--admin-sider-border': isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(5, 5, 5, 0.06)',
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
  const siderBg = isDark
    ? mixHexColors(backgroundColor, primaryColor, 0.12)
    : mixHexColors(backgroundColor, '#ffffff', 0.82);

  return {
    layout: {
      sider: {
        colorMenuBackground: siderBg,
        colorBgCollapsedButton: siderBg,
        colorTextCollapsedButton: isDark ? '#e5e7eb' : 'rgba(0, 0, 0, 0.65)',
        colorTextCollapsedButtonHover: isDark ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)',
        colorMenuItemDivider: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(5, 5, 5, 0.06)',
        colorTextMenu: isDark ? '#cbd5e1' : 'rgba(0, 0, 0, 0.65)',
        colorTextMenuSecondary: isDark ? '#94a3b8' : 'rgba(0, 0, 0, 0.45)',
        colorTextMenuTitle: isDark ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuItemHover: isDark ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuActive: isDark ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)',
        colorTextMenuSelected: isDark ? '#f8fafc' : primaryColor,
        colorBgMenuItemHover: toRgba(primaryColor, isDark ? 0.18 : 0.08),
        colorBgMenuItemSelected: toRgba(primaryColor, isDark ? 0.24 : 0.12),
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
