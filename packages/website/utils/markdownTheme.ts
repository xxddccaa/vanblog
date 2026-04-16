export const MARKDOWN_THEME_PLAIN_PRESET = '__vanblog_plain__';
export const MARKDOWN_THEME_HOTFIX_URL = '/markdown-themes/vanblog-theme-hotfix.css';

export const MARKDOWN_THEME_DEFAULTS = {
  light: '/markdown-themes/phycat-sky-light-only.css',
  dark: '/markdown-themes/phycat-sky-dark-only.css',
} as const;

export type MarkdownThemeMode = 'light' | 'dark';

export type MarkdownThemeConfig = {
  markdownLightThemeUrl?: string;
  markdownDarkThemeUrl?: string;
  markdownLightThemePreset?: string;
  markdownDarkThemePreset?: string;
};

export const resolveMarkdownThemeUrl = (
  theme: MarkdownThemeMode,
  config?: MarkdownThemeConfig,
) => {
  const customUrl =
    theme === 'light' ? config?.markdownLightThemeUrl : config?.markdownDarkThemeUrl;
  const preset =
    theme === 'light'
      ? config?.markdownLightThemePreset
      : config?.markdownDarkThemePreset;

  if (customUrl) {
    return customUrl;
  }

  if (preset === MARKDOWN_THEME_PLAIN_PRESET) {
    return '';
  }

  if (preset) {
    return preset;
  }

  return MARKDOWN_THEME_DEFAULTS[theme];
};

export const resolveMarkdownThemeConfig = (config?: MarkdownThemeConfig) => ({
  markdownLightThemeUrl: resolveMarkdownThemeUrl('light', config),
  markdownDarkThemeUrl: resolveMarkdownThemeUrl('dark', config),
});

export const getMarkdownThemeId = (href?: string) => {
  if (!href) {
    return '';
  }

  try {
    const pathname = new URL(href, 'https://vanblog.local').pathname;
    const fileName = pathname.split('/').pop() || '';
    return fileName.replace(/\.css$/i, '');
  } catch (error) {
    const fileName = href.split('/').pop()?.split('?')[0]?.split('#')[0] || '';
    return fileName.replace(/\.css$/i, '');
  }
};
