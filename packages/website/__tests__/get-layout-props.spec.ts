import { describe, expect, it } from "vitest";

import { getLayoutProps } from "../utils/getLayoutProps";

describe("getLayoutProps", () => {
  it("normalizes the public moment menu label to 动态", () => {
    const layoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [
        { id: 1, name: "首页", value: "/", level: 0 },
        { id: 5, name: "个人动态", value: "/moment", level: 0 },
      ],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
        },
      },
    } as any);

    expect(layoutProps.menus.find((item) => item.value === "/moment")?.name).toBe("动态");
  });

  it("maps legacy auto default theme settings to dark", () => {
    const layoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
          defaultTheme: "auto",
        },
      },
    } as any);

    expect(layoutProps.defaultTheme).toBe("dark");
  });

  it("defaults article width mode to standard and preserves explicit width modes", () => {
    const defaultLayoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
        },
      },
    } as any);

    const ultraWideLayoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
          articleWidthMode: "ultraWide",
        },
      },
    } as any);

    const fullLayoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
          articleWidthMode: "full",
        },
      },
    } as any);

    expect(defaultLayoutProps.articleWidthMode).toBe("standard");
    expect(ultraWideLayoutProps.articleWidthMode).toBe("ultraWide");
    expect(fullLayoutProps.articleWidthMode).toBe("full");
  });

  it("defaults front card surface colors and preserves explicit overrides", () => {
    const defaultLayoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
        },
      },
    } as any);

    const customLayoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
          frontCardBackgroundColor: "#f5fbff",
          frontCardBackgroundColorDark: "#15314d",
        },
      },
    } as any);

    expect(defaultLayoutProps.frontCardBackgroundColor).toBe("#ffffff");
    expect(defaultLayoutProps.frontCardBackgroundColorDark).toBe("#102033");
    expect(customLayoutProps.frontCardBackgroundColor).toBe("#f5fbff");
    expect(customLayoutProps.frontCardBackgroundColorDark).toBe("#15314d");
  });
});
