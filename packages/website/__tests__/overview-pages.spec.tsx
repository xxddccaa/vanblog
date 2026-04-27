import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

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

vi.mock("../components/OverviewPostCard", () => ({
  default: ({ title }: { title: string }) =>
    React.createElement("article", { "data-type": "overview" }, title),
}));

vi.mock("../components/ArchiveSummaryPage", () => ({
  default: ({ title, description, summary, basePath }: any) =>
    React.createElement(
      "section",
      { "data-base-path": basePath },
      `${title}|${description}|${summary.totalArticles}|${summary.years.map((year: any) => year.year).join(",")}`,
    ),
}));

vi.mock("../components/ArchiveMonthPage", () => ({
  default: ({ title, description, articles }: any) =>
    React.createElement(
      "section",
      null,
      `${title}|${description}|${articles.map((article: any) => article.title).join(",")}`,
    ),
}));

vi.mock("../utils/getPageProps", () => ({
  getIndexPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      siteName: "VanBlog",
      openArticleLinksInNewWindow: "false",
      showEditButton: "false",
      showExpirationReminder: "true",
      enableComment: "true",
      copyrightAggreement: "CC BY-NC-SA 4.0",
      codeMaxLines: 12,
      homePageSize: 5,
    },
    authorCardProps: {
      author: "xxddccaa",
      desc: "blogger",
      logo: "/author-logo.svg",
      logoDark: "",
      socials: [],
      showSubMenu: "false",
      showRSS: "true",
    },
    currPage: 1,
    totalPosts: 12,
    articles: [
      {
        id: 1,
        title: "Home Article",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-10T00:00:00.000Z",
        category: "Architecture",
        content: "preview",
        private: false,
        top: 0,
      },
    ],
  } as any),
  getArchivePageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      siteName: "VanBlog",
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {
      author: "xxddccaa",
    },
    summary: {
      totalArticles: 6,
      years: [
        {
          year: "2026",
          articleCount: 4,
          months: [{ month: "04", articleCount: 4 }],
        },
      ],
    },
  } as any),
  getArchiveMonthPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      siteName: "VanBlog",
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {
      author: "xxddccaa",
    },
    year: "2026",
    month: "04",
    articles: [
      {
        id: 2,
        title: "Archive Article",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-09T00:00:00.000Z",
        category: "Caching",
        content: "preview",
        private: false,
        top: 0,
        tags: ["cloudflare"],
      },
    ],
  } as any),
}));

vi.mock("../utils/loadConfig", () => ({
  revalidate: {
    revalidate: 60,
  },
}));

describe("overview and archive page cache shells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps home static props free of fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../page-modules/index");
    const result = await page.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: expect.objectContaining({
        currPage: 1,
        totalPosts: 12,
        articles: [expect.objectContaining({ title: "Home Article" })],
      }),
      revalidate: 60,
    });
  });

  it("renders the home page as a stable shell with archive entry CTA", async () => {
    const page = await import("../page-modules/index");
    const html = renderToStaticMarkup(
      React.createElement(page.default as any, {
        layoutProps: {
          siteName: "VanBlog",
          openArticleLinksInNewWindow: "false",
          showEditButton: "false",
          showExpirationReminder: "true",
          enableComment: "true",
          copyrightAggreement: "CC BY-NC-SA 4.0",
          codeMaxLines: 12,
          homePageSize: 5,
        },
        authorCardProps: { author: "xxddccaa" },
        currPage: 1,
        totalPosts: 12,
        articles: [
          {
            id: 1,
            title: "Home Article",
            updatedAt: "2026-04-11T00:00:00.000Z",
            createdAt: "2026-04-10T00:00:00.000Z",
            category: "Architecture",
            content: "preview",
            private: false,
            top: 0,
          },
        ],
      }),
    );

    expect(html).toContain("Home Article");
    expect(html).toContain("查看全部归档");
    expect(html).toContain('href="/archive"');
    expect(html).not.toContain("page-nav-");
    expect(html).not.toContain("正在加载文章碎片");
    expect(html).not.toContain("当前文章评论数");
  });

  it("keeps archive summary static props free of fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../page-modules/archive");
    const result = await page.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: expect.objectContaining({
        summary: expect.objectContaining({ totalArticles: 6 }),
      }),
      revalidate: 60,
    });
  });

  it("renders archive summary and month routes as stable cache shells", async () => {
    const archivePage = await import("../page-modules/archive");
    const archiveMonthPage = await import("../page-modules/archive/[year]/[month]");

    const archiveHtml = renderToStaticMarkup(
      React.createElement(archivePage.default as any, {
        layoutProps: {
          siteName: "VanBlog",
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: { author: "xxddccaa" },
        summary: {
          totalArticles: 6,
          years: [
            {
              year: "2026",
              articleCount: 4,
              months: [{ month: "04", articleCount: 4 }],
            },
          ],
        },
      }),
    );
    const monthHtml = renderToStaticMarkup(
      React.createElement(archiveMonthPage.default as any, {
        layoutProps: {
          siteName: "VanBlog",
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: { author: "xxddccaa" },
        year: "2026",
        month: "04",
        articles: [
          {
            id: 2,
            title: "Archive Article",
            updatedAt: "2026-04-11T00:00:00.000Z",
            createdAt: "2026-04-09T00:00:00.000Z",
            category: "Caching",
            content: "preview",
            private: false,
            top: 0,
            tags: ["cloudflare"],
          },
        ],
      }),
    );

    expect(archiveHtml).toContain("归档|按年与月份查看全站稳定归档。|6|2026");
    expect(archiveHtml).toContain('data-base-path="/archive"');
    expect(monthHtml).toContain("2026 年 04 月|查看 2026 年 04 月 发布的全部文章。|Archive Article");
    expect(monthHtml).not.toContain("正在加载文章碎片");
  });
});
