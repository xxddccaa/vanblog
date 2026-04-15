import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("../components/AuthorCard", () => ({
  default: () => React.createElement("div", null, "author-card"),
}));

vi.mock("../components/PostCard", () => ({
  default: ({ title, type, content }: { title: string; type: string; content: string }) =>
    React.createElement("article", { "data-type": type }, `${title}:${content}`),
}));

vi.mock("../components/LinkCard", () => ({
  default: ({ link }: { link: { name: string } }) => React.createElement("div", null, `link-card-${link.name}`),
}));

vi.mock("../components/Markdown", () => ({
  default: ({ content }: { content: string }) => React.createElement("div", null, content),
}));

vi.mock("../components/WaLine", () => ({
  default: ({ enable }: { enable: string }) => React.createElement("div", null, `waline-${enable}`),
}));

vi.mock("../components/ArchiveSummaryPage", () => ({
  default: ({ title, summary, basePath, selectedYear }: any) =>
    React.createElement(
      "section",
      { "data-base-path": basePath, "data-selected-year": selectedYear || "" },
      `${title}|${summary.totalArticles}|${summary.years.map((year: any) => year.year).join(",")}`,
    ),
}));

vi.mock("../components/ArchiveMonthPage", () => ({
  default: ({ title, articles }: any) =>
    React.createElement(
      "section",
      null,
      `${title}|${articles.map((article: any) => article.title).join(",")}`,
    ),
}));

vi.mock("../utils/getPageProps", () => ({
  getAboutPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      enableComment: "true",
      showExpirationReminder: "true",
      copyrightAggreement: "CC BY-NC-SA 4.0",
      showEditButton: "false",
      codeMaxLines: 12,
    },
    authorCardProps: {},
    donates: [],
    about: {
      updatedAt: "2026-04-11T00:00:00.000Z",
      content: "about body",
    },
    pay: ["/ali.png", "/wechat.png"],
    payDark: ["/ali-dark.png", "/wechat-dark.png"],
    showDonateInfo: "false",
    showDonateInAbout: "false",
  } as any),
  getLinkPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      enableComment: "true",
      siteName: "VanBlog",
      description: "Cache-first blog",
      logo: "/logo.svg",
    },
    authorCardProps: {
      logo: "/author-logo.svg",
    },
    links: [
      { name: "Edge Cache", url: "https://example.com" },
      { name: "Fragments", url: "https://example.org" },
    ],
  } as any),
  getCategoryArchivePageProps: vi.fn().mockImplementation(async (category: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    category,
    summary: {
      totalArticles: 2,
      years: [
        { year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] },
      ],
    },
  }) as any),
  getCategoryArchiveYearPageProps: vi.fn().mockImplementation(async (category: string, year: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    category,
    year,
    summary: {
      totalArticles: 2,
      years: [
        { year, articleCount: 2, months: [{ month: "04", articleCount: 2 }] },
      ],
    },
  }) as any),
  getCategoryArchiveMonthPageProps: vi.fn().mockImplementation(async (category: string, year: string, month: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    category,
    year,
    month,
    articles: [
      { id: 1, title: `${category} Archive Article`, createdAt: "", updatedAt: "", category, content: "", private: false, tags: [] },
    ],
  }) as any),
  getTagArchivePageProps: vi.fn().mockImplementation(async (tag: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    tag,
    summary: {
      totalArticles: 2,
      years: [
        { year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] },
      ],
    },
  }) as any),
  getTagArchiveYearPageProps: vi.fn().mockImplementation(async (tag: string, year: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    tag,
    year,
    summary: {
      totalArticles: 2,
      years: [
        { year, articleCount: 2, months: [{ month: "04", articleCount: 2 }] },
      ],
    },
  }) as any),
  getTagArchiveMonthPageProps: vi.fn().mockImplementation(async (tag: string, year: string, month: string) => ({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    tag,
    year,
    month,
    articles: [
      { id: 2, title: `${tag} Archive Article`, createdAt: "", updatedAt: "", category: "Caching", content: "", private: false, tags: [] },
    ],
  }) as any),
}));

vi.mock("../api/getMoments", () => ({
  getMoments: vi.fn().mockResolvedValue({
    moments: [],
    total: 0,
  }),
  createMoment: vi.fn(),
}));

vi.mock("../utils/loadConfig", () => ({
  revalidate: {
    revalidate: 60,
  },
}));

describe("static content and archive detail page cache shells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps about and link static props free of fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const aboutPage = await import("../page-modules/about");
    const linkPage = await import("../page-modules/link");

    const aboutResult = await aboutPage.getStaticProps();
    const linkResult = await linkPage.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(aboutResult).toEqual({
      props: expect.objectContaining({
        about: expect.objectContaining({ content: "about body" }),
      }),
      revalidate: 60,
    });
    expect(linkResult).toEqual({
      props: expect.objectContaining({
        links: expect.arrayContaining([expect.objectContaining({ name: "Edge Cache" })]),
      }),
      revalidate: 60,
    });
  });

  it("renders the about and link pages without article fragment placeholders", async () => {
    const aboutPage = await import("../page-modules/about");
    const linkPage = await import("../page-modules/link");

    const aboutHtml = renderToStaticMarkup(
      React.createElement(aboutPage.default as any, {
        layoutProps: {
          enableComment: "true",
          showExpirationReminder: "true",
          copyrightAggreement: "CC BY-NC-SA 4.0",
          showEditButton: "false",
          codeMaxLines: 12,
        },
        authorCardProps: {},
        donates: [],
        about: {
          updatedAt: "2026-04-11T00:00:00.000Z",
          content: "about body",
        },
        pay: ["/ali.png", "/wechat.png"],
        payDark: ["/ali-dark.png", "/wechat-dark.png"],
        showDonateInfo: "false",
        showDonateInAbout: "false",
      }),
    );
    const linkHtml = renderToStaticMarkup(
      React.createElement(linkPage.default as any, {
        layoutProps: {
          enableComment: "true",
          siteName: "VanBlog",
          description: "Cache-first blog",
          logo: "/logo.svg",
        },
        authorCardProps: {
          logo: "/author-logo.svg",
        },
        links: [
          { name: "Edge Cache", url: "https://example.com" },
          { name: "Fragments", url: "https://example.org" },
        ],
      }),
    );

    expect(aboutHtml).toContain('data-type="about"');
    expect(aboutHtml).toContain("关于我:about body");
    expect(linkHtml).toContain("友情链接");
    expect(linkHtml).toContain("link-card-Edge Cache");
    expect(linkHtml).not.toContain("正在加载文章碎片");
  });

  it("renders the moment page with the public-facing 动态 title", async () => {
    const momentPage = await import("../page-modules/moment");

    const html = renderToStaticMarkup(
      React.createElement(momentPage.default as any, {
        initialMoments: [],
        initialTotal: 0,
        authorCardProps: {},
        siteName: "VanBlog",
        description: "Cache-first blog",
        ipcNumber: "",
        since: "2020-01-01T00:00:00.000Z",
        ipcHref: "",
        gaBeianNumber: "",
        gaBeianUrl: "",
        gaBeianLogoUrl: "",
        copyrightAggreement: "CC BY-NC-SA 4.0",
        logo: "/logo.svg",
        categories: [],
        favicon: "/favicon.ico",
        siteDesc: "Cache-first blog",
        baiduAnalysisID: "",
        gaAnalysisID: "",
        logoDark: "/logo-dark.svg",
        version: "1.2.0",
        menus: [{ id: 5, name: "动态", value: "/moment", level: 0 }],
        showSubMenu: "false",
        showAdminButton: "false",
        showFriends: "false",
        headerLeftContent: "siteName",
        enableComment: "true",
        defaultTheme: "dark",
        enableCustomizing: "false",
        showDonateButton: "false",
        showCopyRight: "true",
        showRSS: "false",
        showExpirationReminder: "true",
        openArticleLinksInNewWindow: "false",
        showEditButton: "false",
        subMenuOffset: 0,
        homePageSize: 5,
        privateSite: "false",
        codeMaxLines: 12,
        showRunningTime: "false",
        backgroundImage: "",
        backgroundImageDark: "",
        markdownLightThemeUrl: "",
        markdownDarkThemeUrl: "",
      }),
    );

    expect(html).toContain("动态");
    expect(html).not.toContain("个人动态");
  });

  it("keeps category archive summary, year, and month props free of fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const summaryPage = await import("../page-modules/category/[category]");
    const yearPage = await import("../page-modules/category/[category]/archive/[year]");
    const monthPage = await import("../page-modules/category/[category]/archive/[year]/[month]");

    const summaryResult = await summaryPage.getStaticProps({ params: { category: "Caching" } });
    const yearResult = await yearPage.getStaticProps({ params: { category: "Caching", year: "2026" } });
    const monthResult = await monthPage.getStaticProps({ params: { category: "Caching", year: "2026", month: "04" } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(summaryResult).toEqual({
      props: expect.objectContaining({ category: "Caching" }),
      revalidate: 60,
    });
    expect(yearResult).toEqual({
      props: expect.objectContaining({ category: "Caching", year: "2026" }),
      revalidate: 60,
    });
    expect(monthResult).toEqual({
      props: expect.objectContaining({ category: "Caching", month: "04" }),
      revalidate: 60,
    });
  });

  it("renders category archive routes as stable shells", async () => {
    const summaryPage = await import("../page-modules/category/[category]");
    const yearPage = await import("../page-modules/category/[category]/archive/[year]");
    const monthPage = await import("../page-modules/category/[category]/archive/[year]/[month]");

    const summaryHtml = renderToStaticMarkup(
      React.createElement(summaryPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        category: "Caching",
        summary: {
          totalArticles: 2,
          years: [{ year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] }],
        },
      }),
    );
    const yearHtml = renderToStaticMarkup(
      React.createElement(yearPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        category: "Caching",
        year: "2026",
        summary: {
          totalArticles: 2,
          years: [{ year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] }],
        },
      }),
    );
    const monthHtml = renderToStaticMarkup(
      React.createElement(monthPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        category: "Caching",
        year: "2026",
        month: "04",
        articles: [
          { id: 1, title: "Caching Archive Article", createdAt: "", updatedAt: "", category: "Caching", content: "", private: false, tags: [] },
        ],
      }),
    );

    expect(summaryHtml).toContain("Caching|2|2026");
    expect(summaryHtml).toContain('data-base-path="/category/Caching/archive"');
    expect(yearHtml).toContain('data-selected-year="2026"');
    expect(monthHtml).toContain("Caching · 2026 年 04 月|Caching Archive Article");
    expect(monthHtml).not.toContain("正在加载文章碎片");
  });

  it("keeps tag archive summary, year, and month props free of fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const summaryPage = await import("../page-modules/tag/[tag]");
    const yearPage = await import("../page-modules/tag/[tag]/archive/[year]");
    const monthPage = await import("../page-modules/tag/[tag]/archive/[year]/[month]");

    const summaryResult = await summaryPage.getStaticProps({ params: { tag: "Cloudflare" } });
    const yearResult = await yearPage.getStaticProps({ params: { tag: "Cloudflare", year: "2026" } });
    const monthResult = await monthPage.getStaticProps({ params: { tag: "Cloudflare", year: "2026", month: "04" } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(summaryResult).toEqual({
      props: expect.objectContaining({ tag: "Cloudflare" }),
      revalidate: 60,
    });
    expect(yearResult).toEqual({
      props: expect.objectContaining({ tag: "Cloudflare", year: "2026" }),
      revalidate: 60,
    });
    expect(monthResult).toEqual({
      props: expect.objectContaining({ tag: "Cloudflare", month: "04" }),
      revalidate: 60,
    });
  });

  it("renders tag archive routes as stable shells", async () => {
    const summaryPage = await import("../page-modules/tag/[tag]");
    const yearPage = await import("../page-modules/tag/[tag]/archive/[year]");
    const monthPage = await import("../page-modules/tag/[tag]/archive/[year]/[month]");

    const summaryHtml = renderToStaticMarkup(
      React.createElement(summaryPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        tag: "Cloudflare",
        summary: {
          totalArticles: 2,
          years: [{ year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] }],
        },
      }),
    );
    const yearHtml = renderToStaticMarkup(
      React.createElement(yearPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        tag: "Cloudflare",
        year: "2026",
        summary: {
          totalArticles: 2,
          years: [{ year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] }],
        },
      }),
    );
    const monthHtml = renderToStaticMarkup(
      React.createElement(monthPage.default as any, {
        layoutProps: { openArticleLinksInNewWindow: "false" },
        authorCardProps: {},
        tag: "Cloudflare",
        year: "2026",
        month: "04",
        articles: [
          { id: 2, title: "Cloudflare Archive Article", createdAt: "", updatedAt: "", category: "Caching", content: "", private: false, tags: [] },
        ],
      }),
    );

    expect(summaryHtml).toContain("Cloudflare|2|2026");
    expect(summaryHtml).toContain('data-base-path="/tag/Cloudflare/archive"');
    expect(yearHtml).toContain('data-selected-year="2026"');
    expect(monthHtml).toContain("Cloudflare · 2026 年 04 月|Cloudflare Archive Article");
    expect(monthHtml).not.toContain("正在加载文章碎片");
  });
});
