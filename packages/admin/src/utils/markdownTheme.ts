import { useEffect, useMemo } from 'react';

export const MARKDOWN_THEME_PLAIN_PRESET = '__vanblog_plain__';
export const MARKDOWN_THEME_HOTFIX_URL = '/markdown-themes/vanblog-theme-hotfix.css';
export const MARKDOWN_THEME_CACHE_BUST_PARAM = 'vbv';
export const MARKDOWN_THEME_ASSET_VERSION =
  process.env.NEXT_PUBLIC_MARKDOWN_THEME_ASSET_VERSION || 'dev';

export const MARKDOWN_THEME_DEFAULTS = {
  light: '/markdown-themes/phycat-sky-light-only.css',
  dark: '/markdown-themes/phycat-sky-dark-only.css',
} as const;

type MarkdownThemeMode = 'light' | 'dark';

type MarkdownThemeConfig = {
  markdownLightThemeUrl?: string;
  markdownDarkThemeUrl?: string;
  markdownLightThemePreset?: string;
  markdownDarkThemePreset?: string;
};

const isManagedMarkdownThemeAsset = (href: string) => {
  try {
    const pathname = new URL(href, 'https://vanblog.local').pathname;
    return pathname.startsWith('/markdown-themes/');
  } catch (error) {
    return href.startsWith('/markdown-themes/');
  }
};

export const withMarkdownThemeAssetVersion = (href?: string) => {
  if (!href || !isManagedMarkdownThemeAsset(href)) {
    return href || '';
  }

  try {
    const url = new URL(href, 'https://vanblog.local');
    url.searchParams.set(MARKDOWN_THEME_CACHE_BUST_PARAM, MARKDOWN_THEME_ASSET_VERSION);
    return href.startsWith('http://') || href.startsWith('https://')
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    return href;
  }
};

const MANAGED_THEME_LINK_SELECTOR = 'link[data-vanblog-admin-markdown-theme-link]';
const MANAGED_THEME_HOTFIX_SELECTOR = 'link[data-vanblog-admin-markdown-theme-hotfix]';

export const resolveMarkdownThemeUrl = (theme: MarkdownThemeMode, config?: MarkdownThemeConfig) => {
  const customUrl =
    theme === 'light' ? config?.markdownLightThemeUrl : config?.markdownDarkThemeUrl;
  const preset =
    theme === 'light' ? config?.markdownLightThemePreset : config?.markdownDarkThemePreset;

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

const syncThemeStylesheet = (theme: MarkdownThemeMode, href: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  const selector = `${MANAGED_THEME_LINK_SELECTOR}[data-theme-for='${theme}']`;
  const existing = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!href) {
    existing?.remove();
    return;
  }

  const versionedHref = withMarkdownThemeAssetVersion(href);

  if (existing) {
    existing.setAttribute('href', versionedHref);
    return;
  }

  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', versionedHref);
  link.setAttribute('data-theme-for', theme);
  link.setAttribute('data-vanblog-admin-markdown-theme-link', 'true');
  document.head.appendChild(link);
};

const syncThemeHotfixStylesheet = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.head.querySelector(
    MANAGED_THEME_HOTFIX_SELECTOR,
  ) as HTMLLinkElement | null;

  if (existing) {
    existing.setAttribute('href', withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL));
    return;
  }

  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL));
  link.setAttribute('data-vanblog-admin-markdown-theme-hotfix', 'true');
  document.head.appendChild(link);
};

export const useAdminMarkdownTheme = (config?: MarkdownThemeConfig) => {
  const resolvedThemeConfig = useMemo(
    () => resolveMarkdownThemeConfig(config),
    [
      config?.markdownDarkThemePreset,
      config?.markdownDarkThemeUrl,
      config?.markdownLightThemePreset,
      config?.markdownLightThemeUrl,
    ],
  );

  useEffect(() => {
    syncThemeStylesheet('light', resolvedThemeConfig.markdownLightThemeUrl);
    syncThemeStylesheet('dark', resolvedThemeConfig.markdownDarkThemeUrl);
    syncThemeHotfixStylesheet();
  }, [resolvedThemeConfig.markdownDarkThemeUrl, resolvedThemeConfig.markdownLightThemeUrl]);

  return resolvedThemeConfig;
};

export type { MarkdownThemeConfig };
