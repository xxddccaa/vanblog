import { describe, expect, it } from 'vitest';
import { getLayoutProps } from '../utils/getLayoutProps';
import {
  getMarkdownThemeId,
  MARKDOWN_THEME_ASSET_VERSION,
  MARKDOWN_THEME_CACHE_BUST_PARAM,
  MARKDOWN_THEME_DEFAULTS,
  MARKDOWN_THEME_HOTFIX_URL,
  MARKDOWN_THEME_PLAIN_PRESET,
  resolveMarkdownThemeConfig,
  withMarkdownThemeAssetVersion,
} from '../utils/markdownTheme';

const createPublicMeta = (siteInfoOverrides: Record<string, unknown> = {}) => ({
  version: '1.3.7',
  tags: [],
  totalArticles: 0,
  totalWordCount: 0,
  menus: [],
  meta: {
    categories: [],
    links: [],
    socials: [],
    rewards: [],
    about: {
      updatedAt: new Date('2026-04-15T00:00:00.000Z').toISOString(),
      content: '',
    },
    siteInfo: {
      author: 'VanBlog',
      authorDesc: 'theme tests',
      authorLogo: '/logo.svg',
      authorLogoDark: '/logo-dark.svg',
      siteLogo: '/logo.svg',
      siteLogoDark: '/logo-dark.svg',
      favicon: '/favicon.ico',
      siteName: 'VanBlog',
      siteDesc: 'Theme checks',
      beianNumber: '',
      beianUrl: '',
      gaBeianNumber: '',
      gaBeianUrl: '',
      gaBeianLogoUrl: '',
      payAliPay: '',
      payWechat: '',
      payAliPayDark: '',
      payWechatDark: '',
      since: new Date('2026-04-15T00:00:00.000Z').toISOString(),
      baseUrl: '',
      gaAnalysisId: '',
      baiduAnalysisId: '',
      copyrightAggreement: 'CC BY-NC-SA 4.0',
      enableComment: 'true',
      showSubMenu: 'false',
      headerLeftContent: 'siteName',
      subMenuOffset: 0,
      showAdminButton: 'true',
      showDonateInfo: 'true',
      showFriends: 'true',
      showCopyRight: 'true',
      showDonateButton: 'true',
      showDonateInAbout: 'false',
      allowOpenHiddenPostByUrl: 'false',
      defaultTheme: 'dark',
      enableCustomizing: 'true',
      showRSS: 'true',
      openArticleLinksInNewWindow: 'false',
      showExpirationReminder: 'false',
      showEditButton: 'false',
      homePageSize: 5,
      privateSite: 'false',
      codeMaxLines: 15,
      showRunningTime: 'false',
      backgroundImage: '',
      backgroundImageDark: '',
      markdownLightThemeUrl: '',
      markdownDarkThemeUrl: '',
      markdownLightThemePreset: '',
      markdownDarkThemePreset: '',
      ...siteInfoOverrides,
    },
  },
}) as any;

describe('markdown theme resolution', () => {
  it('uses the sky theme when theme fields are blank', () => {
    expect(
      resolveMarkdownThemeConfig({
        markdownLightThemeUrl: '',
        markdownDarkThemeUrl: '',
      }),
    ).toEqual({
      markdownLightThemeUrl: MARKDOWN_THEME_DEFAULTS.light,
      markdownDarkThemeUrl: MARKDOWN_THEME_DEFAULTS.dark,
    });

    const layoutProps = getLayoutProps(createPublicMeta());

    expect(layoutProps.markdownLightThemeUrl).toBe(MARKDOWN_THEME_DEFAULTS.light);
    expect(layoutProps.markdownDarkThemeUrl).toBe(MARKDOWN_THEME_DEFAULTS.dark);
  });

  it('keeps the plain preset unthemed', () => {
    const layoutProps = getLayoutProps(
      createPublicMeta({
        markdownLightThemePreset: MARKDOWN_THEME_PLAIN_PRESET,
        markdownDarkThemePreset: MARKDOWN_THEME_PLAIN_PRESET,
      }),
    );

    expect(layoutProps.markdownLightThemeUrl).toBe('');
    expect(layoutProps.markdownDarkThemeUrl).toBe('');
  });

  it('prefers custom theme urls over presets', () => {
    const layoutProps = getLayoutProps(
      createPublicMeta({
        markdownLightThemeUrl: '/markdown-themes/custom-light.css',
        markdownDarkThemeUrl: '/markdown-themes/custom-dark.css',
        markdownLightThemePreset: MARKDOWN_THEME_PLAIN_PRESET,
        markdownDarkThemePreset: MARKDOWN_THEME_PLAIN_PRESET,
      }),
    );

    expect(layoutProps.markdownLightThemeUrl).toBe('/markdown-themes/custom-light.css');
    expect(layoutProps.markdownDarkThemeUrl).toBe('/markdown-themes/custom-dark.css');
  });

  it('extracts theme ids from css urls for hotfix targeting', () => {
    expect(getMarkdownThemeId(MARKDOWN_THEME_DEFAULTS.light)).toBe('phycat-sky-light-only');
    expect(getMarkdownThemeId('/markdown-themes/custom-dark.css?v=2#hash')).toBe('custom-dark');
    expect(getMarkdownThemeId('')).toBe('');
    expect(MARKDOWN_THEME_HOTFIX_URL).toBe('/markdown-themes/vanblog-theme-hotfix.css');
  });

  it('adds a stable version query only to managed markdown theme assets', () => {
    expect(withMarkdownThemeAssetVersion('/markdown-themes/custom-dark.css')).toBe(
      `/markdown-themes/custom-dark.css?${MARKDOWN_THEME_CACHE_BUST_PARAM}=${MARKDOWN_THEME_ASSET_VERSION}`,
    );
    expect(withMarkdownThemeAssetVersion('/markdown-themes/custom-dark.css?foo=bar#demo')).toBe(
      `/markdown-themes/custom-dark.css?foo=bar&${MARKDOWN_THEME_CACHE_BUST_PARAM}=${MARKDOWN_THEME_ASSET_VERSION}#demo`,
    );
    expect(withMarkdownThemeAssetVersion('https://cdn.example.com/site.css')).toBe(
      'https://cdn.example.com/site.css',
    );
  });
});
