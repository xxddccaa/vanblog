import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicMeta = vi.fn();
const getLayoutProps = vi.fn();
const getAuthorCardShellProps = vi.fn();
const getArticlesByOption = vi.fn();
const getArchiveSummary = vi.fn();
const getArchiveMonthArticles = vi.fn();
const getCategoryArchiveSummary = vi.fn();
const getCategoryArchiveMonthArticles = vi.fn();
const getTagArchiveSummary = vi.fn();
const getTagArchiveMonthArticles = vi.fn();
const getCategorySummary = vi.fn();
const getTimelineSummary = vi.fn();
const getArticleByIdOrPathname = vi.fn();

vi.mock("../api/getAllData", () => ({
  getPublicMeta,
}));

vi.mock("../api/getArticles", () => ({
  getArticlesByOption,
  getArchiveSummary,
  getArchiveMonthArticles,
  getCategoryArchiveSummary,
  getCategoryArchiveMonthArticles,
  getTagArchiveSummary,
  getTagArchiveMonthArticles,
  getCategorySummary,
  getTimelineSummary,
  getArticleByIdOrPathname,
}));

vi.mock("../utils/getLayoutProps", () => ({
  getLayoutProps,
  getAuthorCardShellProps,
}));

vi.mock("../utils/loadConfig", () => ({
  config: {
    baseUrl: "https://blog.example.com/",
  },
  revalidate: {
    revalidate: 60,
  },
}));

describe("page props cache shells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    getPublicMeta.mockResolvedValue({
      totalArticles: 12,
      tags: ["Cloudflare", "Cache"],
      meta: {
        links: [],
        about: { content: "about" },
        rewards: [],
        siteInfo: {
          homePageSize: 5,
          author: "xxddccaa",
        },
      },
    });
    getLayoutProps.mockReturnValue({
      openArticleLinksInNewWindow: "false",
      homePageSize: 5,
      showSubMenu: "false",
    });
    getAuthorCardShellProps.mockReturnValue({
      author: "xxddccaa",
      desc: "blogger",
      logo: "/author-logo.svg",
      logoDark: "",
      socials: [],
      showSubMenu: "false",
      showRSS: "true",
    });
    getCategorySummary.mockResolvedValue([]);
    getTimelineSummary.mockResolvedValue([]);
    getArchiveSummary.mockResolvedValue({ totalArticles: 0, years: [] });
    getCategoryArchiveSummary.mockResolvedValue({ totalArticles: 0, years: [] });
    getTagArchiveSummary.mockResolvedValue({ totalArticles: 0, years: [] });
  });

  it("builds home page props with stable article shells only", async () => {
    getArticlesByOption.mockResolvedValue({
      articles: [
        {
          id: 1,
          title: "Home Article",
          pathname: "home-article",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-10T00:00:00.000Z",
          category: "Architecture",
          content: "preview",
          private: false,
          tags: ["cache"],
          viewer: 99,
          visited: 66,
          commentCount: 12,
        },
      ],
    });

    const { getIndexPageProps } = await import("../utils/getPageProps");
    const result = await getIndexPageProps();

    expect(getArticlesByOption).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      withPreviewContent: true,
    });
    expect(result).toEqual({
      layoutProps: expect.objectContaining({ homePageSize: 5 }),
      authorCardProps: expect.objectContaining({ author: "xxddccaa" }),
      currPage: 1,
      totalPosts: 12,
      articles: [
        {
          id: 1,
          title: "Home Article",
          pathname: "home-article",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-10T00:00:00.000Z",
          category: "Architecture",
          content: "preview",
          private: false,
          tags: ["cache"],
          author: undefined,
          copyright: undefined,
          top: undefined,
        },
      ],
    });
  });

  it("builds archive summary props from the dedicated archive api", async () => {
    getArchiveSummary.mockResolvedValue({
      totalArticles: 3,
      years: [
        { year: "2026", articleCount: 3, months: [{ month: "04", articleCount: 3 }] },
      ],
    });

    const { getArchivePageProps } = await import("../utils/getPageProps");
    const result = await getArchivePageProps();

    expect(getArchiveSummary).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      layoutProps: expect.objectContaining({ homePageSize: 5 }),
      authorCardProps: expect.objectContaining({ author: "xxddccaa" }),
      summary: {
        totalArticles: 3,
        years: [{ year: "2026", articleCount: 3, months: [{ month: "04", articleCount: 3 }] }],
      },
    });
  });

  it("builds archive month props with stable article shells only", async () => {
    getArchiveMonthArticles.mockResolvedValue([
      {
        id: 2,
        title: "Archive Article",
        pathname: "archive-article",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-09T00:00:00.000Z",
        category: "Caching",
        content: "preview",
        private: false,
        tags: ["cloudflare"],
        viewer: 88,
        visited: 55,
        commentCount: 11,
      },
    ]);

    const { getArchiveMonthPageProps } = await import("../utils/getPageProps");
    const result = await getArchiveMonthPageProps("2026", "04");

    expect(getArchiveMonthArticles).toHaveBeenCalledWith("2026", "04");
    expect(result).toEqual({
      layoutProps: expect.objectContaining({ homePageSize: 5 }),
      authorCardProps: expect.objectContaining({ author: "xxddccaa" }),
      year: "2026",
      month: "04",
      articles: [
        {
          id: 2,
          title: "Archive Article",
          pathname: "archive-article",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Caching",
          content: "preview",
          private: false,
          tags: ["cloudflare"],
          author: undefined,
          copyright: undefined,
          top: undefined,
        },
      ],
    });
  });

  it("builds category archive summary props without touching fragment endpoints", async () => {
    getCategoryArchiveSummary.mockResolvedValue({
      totalArticles: 2,
      years: [
        { year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] },
      ],
    });

    const { getCategoryArchivePageProps } = await import("../utils/getPageProps");
    const result = await getCategoryArchivePageProps("Caching");

    expect(getCategoryArchiveSummary).toHaveBeenCalledWith("Caching");
    expect(result).toEqual({
      layoutProps: expect.objectContaining({ homePageSize: 5 }),
      authorCardProps: expect.objectContaining({ author: "xxddccaa" }),
      category: "Caching",
      summary: {
        totalArticles: 2,
        years: [{ year: "2026", articleCount: 2, months: [{ month: "04", articleCount: 2 }] }],
      },
    });
  });

  it("builds tag archive month props with stable article shells only", async () => {
    getTagArchiveMonthArticles.mockResolvedValue([
      {
        id: 3,
        title: "Tag Archive Article",
        pathname: "tag-archive-article",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-08T00:00:00.000Z",
        category: "Architecture",
        content: "preview",
        private: false,
        tags: ["Cloudflare"],
        viewer: 77,
        visited: 44,
      },
    ]);

    const { getTagArchiveMonthPageProps } = await import("../utils/getPageProps");
    const result = await getTagArchiveMonthPageProps("Cloudflare", "2026", "04");

    expect(getTagArchiveMonthArticles).toHaveBeenCalledWith("Cloudflare", "2026", "04");
    expect(result).toEqual({
      layoutProps: expect.objectContaining({ homePageSize: 5 }),
      authorCardProps: expect.objectContaining({ author: "xxddccaa" }),
      tag: "Cloudflare",
      year: "2026",
      month: "04",
      articles: [
        {
          id: 3,
          title: "Tag Archive Article",
          pathname: "tag-archive-article",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-08T00:00:00.000Z",
          category: "Architecture",
          content: "preview",
          private: false,
          tags: ["Cloudflare"],
          author: undefined,
          copyright: undefined,
          top: undefined,
        },
      ],
    });
  });
});
