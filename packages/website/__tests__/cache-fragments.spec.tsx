import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AuthorCard from "../components/AuthorCard";
import ArticleList from "../components/ArticleList";
import CategoryPage from "../components/CategoryPage";
import PostCard from "../components/PostCard";
import PostFragments from "../components/PostCard/fragments";
import { PostBottom } from "../components/PostCard/bottom";
import { SubTitle } from "../components/PostCard/title";
import TimelinePage from "../components/TimelinePage";

const getArticleNavByIdOrPathname = vi.fn().mockResolvedValue({
  pre: { id: 1, title: "before-change" },
  next: { id: 2, title: "after-change" },
});

const getArticleFragmentsByIdOrPathname = vi.fn().mockResolvedValue({
  commentCount: 9,
  related: [{ id: 3, title: "related-before" }],
  latest: [{ id: 4, title: "latest-before" }],
  hot: [{ id: 5, title: "hot-before" }],
});

const getArticleEngagementByIdOrPathname = vi.fn().mockResolvedValue({
  viewer: 11,
  visited: 22,
  commentCount: 33,
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("headroom.js", () => ({
  default: class Headroom {
    init() {}
  },
}));

vi.mock("../components/ImageBox", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt: alt || "mock-image" }),
}));

vi.mock("../components/SocialCard", () => ({
  default: () => React.createElement("div", null, "socials"),
}));

vi.mock("../components/AlertCard", () => ({
  default: () => React.createElement("div", null, "alert-card"),
}));

vi.mock("../components/CopyRight", () => ({
  default: () => React.createElement("div", null, "copyright-card"),
}));

vi.mock("../components/Reward", () => ({
  default: () => React.createElement("div", null, "reward-card"),
}));

vi.mock("../components/TopPinIcon", () => ({
  default: () => React.createElement("div", null, "top-pin"),
}));

vi.mock("../components/UnLockCard", () => ({
  default: () => React.createElement("div", null, "unlock-card"),
}));

vi.mock("../components/WaLine", () => ({
  default: () => React.createElement("div", null, "waline"),
}));

vi.mock("../components/TocMobile", () => ({
  default: () => React.createElement("div", null, "toc-mobile"),
}));

vi.mock("../components/Markdown", () => ({
  default: ({ content }: { content: string }) => React.createElement("div", null, content),
}));

vi.mock("../components/ArticleList", () => ({
  default: ({ articles }: { articles: Array<{ title: string }> }) =>
    React.createElement(
      "div",
      null,
      articles.map((article) => article.title).join(","),
    ),
}));

vi.mock("../api/getArticles", () => ({
  getArticleNavByIdOrPathname,
  getArticleFragmentsByIdOrPathname,
  getArticleEngagementByIdOrPathname,
  getCategoryArticles: vi.fn().mockResolvedValue([
    { id: 21, title: "category-loaded-article" },
  ]),
  getTimelineArticlesByYear: vi.fn().mockResolvedValue([
    { id: 31, title: "timeline-loaded-article" },
  ]),
}));

describe("public cache fragments", () => {
  it("does not start nav, engagement, or fragment reads while server-rendering overview cards", () => {
    getArticleNavByIdOrPathname.mockClear();
    getArticleFragmentsByIdOrPathname.mockClear();
    getArticleEngagementByIdOrPathname.mockClear();

    const html = renderToStaticMarkup(
      React.createElement(PostCard, {
        id: 1,
        title: "Edge Cache Overview",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        catelog: "Architecture",
        content: "preview<!-- more -->full body",
        setContent: () => undefined,
        type: "overview",
        author: "xxddccaa",
        tags: ["cache"],
        enableComment: "true",
        top: 0,
        private: false,
        openArticleLinksInNewWindow: false,
        copyrightAggreement: "CC BY-NC-SA 4.0",
        customCopyRight: null,
        showExpirationReminder: true,
        showEditButton: false,
      }),
    );

    expect(html).toContain("阅读全文");
    expect(getArticleNavByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleFragmentsByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleEngagementByIdOrPathname).not.toHaveBeenCalled();
  });

  it("keeps author-card counters out of the server-rendered HTML shell", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorCard, {
        option: {
          author: "xxddccaa",
          desc: "blogger",
          logo: "/logo.png",
          logoDark: "",
          postNum: 12,
          catelogNum: 3,
          tagNum: 8,
          socials: [],
          showSubMenu: "false",
          showRSS: "true",
        },
      }),
    );

    expect(html).toContain("--");
    expect(html).not.toContain(">12<");
    expect(html).not.toContain(">3<");
    expect(html).not.toContain(">8<");
  });

  it("keeps author-card html stable even when site counter props change", () => {
    const baseOption = {
      author: "xxddccaa",
      desc: "blogger",
      logo: "/logo.png",
      logoDark: "",
      socials: [],
      showSubMenu: "false" as const,
      showRSS: "true" as const,
    };

    const firstHtml = renderToStaticMarkup(
      React.createElement(AuthorCard, {
        option: {
          ...baseOption,
          postNum: 12,
          catelogNum: 3,
          tagNum: 8,
        },
      }),
    );
    const secondHtml = renderToStaticMarkup(
      React.createElement(AuthorCard, {
        option: {
          ...baseOption,
          postNum: 99,
          catelogNum: 42,
          tagNum: 123,
        },
      }),
    );

    expect(firstHtml).toBe(secondHtml);
    expect(firstHtml).toContain("--");
    expect(firstHtml).not.toContain(">12<");
    expect(firstHtml).not.toContain(">99<");
    expect(firstHtml).not.toContain(">42<");
    expect(firstHtml).not.toContain(">123<");
  });

  it("keeps category page shells on summary data without embedding article lists or stats", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategoryPage, {
        summaries: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
        openArticleLinksInNewWindow: false,
      }),
    );

    expect(html).toContain("Architecture");
    expect(html).toContain("7 篇文章");
    expect(html).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(html).not.toContain("category-loaded-article");
    expect(html).not.toContain("正在加载文章列表");
    expect(html).not.toContain("9999");
  });

  it("keeps timeline page shells on summary data without embedding expanded article lists or stats", () => {
    const html = renderToStaticMarkup(
      React.createElement(TimelinePage, {
        summaries: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
        openArticleLinksInNewWindow: false,
        pageTitle: "时间线",
      }),
    );

    expect(html).toContain("2026");
    expect(html).toContain("6 篇文章");
    expect(html).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(html).not.toContain("timeline-loaded-article");
    expect(html).not.toContain("正在加载文章列表");
    expect(html).not.toContain("9999");
  });

  it("keeps category and timeline shell html stable when fallback stats change", () => {
    const firstCategoryHtml = renderToStaticMarkup(
      React.createElement(CategoryPage, {
        summaries: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
        openArticleLinksInNewWindow: false,
      }),
    );
    const secondCategoryHtml = renderToStaticMarkup(
      React.createElement(CategoryPage, {
        summaries: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
        openArticleLinksInNewWindow: false,
      }),
    );
    const firstTimelineHtml = renderToStaticMarkup(
      React.createElement(TimelinePage, {
        summaries: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
        openArticleLinksInNewWindow: false,
        pageTitle: "时间线",
      }),
    );
    const secondTimelineHtml = renderToStaticMarkup(
      React.createElement(TimelinePage, {
        summaries: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
        openArticleLinksInNewWindow: false,
        pageTitle: "时间线",
      }),
    );

    expect(firstCategoryHtml).toBe(secondCategoryHtml);
    expect(firstTimelineHtml).toBe(secondTimelineHtml);
    expect(firstCategoryHtml).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(firstTimelineHtml).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(firstCategoryHtml).not.toContain("9999");
    expect(firstCategoryHtml).not.toContain("123456");
    expect(firstTimelineHtml).not.toContain("9999");
    expect(firstTimelineHtml).not.toContain("123456");
  });

  it("renders expanded article lists without viewer, visited, or comment-count fragments", () => {
    const html = renderToStaticMarkup(
      React.createElement(ArticleList, {
        articles: [
          {
            id: 21,
            title: "expanded-list-article",
            createdAt: "2026-04-11T00:00:00.000Z",
            tags: ["Cloudflare", "Cache"],
            viewer: 987654321,
            visited: 987654321,
            commentCount: 987654321,
          },
        ],
        showYear: false,
        openArticleLinksInNewWindow: false,
        showTags: true,
      } as any),
    );

    expect(html).toContain("expanded-list-article");
    expect(html).toContain("2026-04-11");
    expect(html).toContain("Cloudflare");
    expect(html).toContain("Cache");
    expect(html).not.toContain("987654321");
    expect(html).not.toContain("当前文章评论数");
    expect(html).not.toContain("正在加载文章碎片");
  });

  it("omits viewer and comment fragments from overview cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(SubTitle, {
        type: "overview",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        catelog: "Architecture",
        enableComment: "true",
        id: 1,
        openArticleLinksInNewWindow: false,
      }),
    );

    expect(html).not.toContain("waline-comment-count");
    expect(html).not.toContain(">0</span>");
  });

  it("keeps overview post cards free of async article fragments", () => {
    const html = renderToStaticMarkup(
      React.createElement(PostCard, {
        id: 1,
        title: "Edge Cache Overview",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        catelog: "Architecture",
        content: "preview<!-- more -->full body",
        setContent: () => undefined,
        type: "overview",
        author: "xxddccaa",
        tags: ["cache"],
        enableComment: "true",
        top: 0,
        private: false,
        openArticleLinksInNewWindow: false,
        copyrightAggreement: "CC BY-NC-SA 4.0",
        customCopyRight: null,
        showExpirationReminder: true,
        showEditButton: false,
      }),
    );

    expect(html).toContain("阅读全文");
    expect(html).not.toContain("正在加载文章碎片");
    expect(html).not.toContain("相关文章");
    expect(html).not.toContain("当前文章评论数");
    expect(html).not.toContain("before-change");
    expect(html).not.toContain("after-change");
    expect(html).not.toContain("waline");
  });

  it("keeps article shell HTML stable when nav and fragment payloads change", async () => {
    const api = await import("../api/getArticles");
    getArticleNavByIdOrPathname.mockClear();
    getArticleFragmentsByIdOrPathname.mockClear();
    getArticleEngagementByIdOrPathname.mockClear();

    const firstBottom = renderToStaticMarkup(
      React.createElement(PostBottom, {
        type: "article",
        id: 1,
        lock: false,
        openArticleLinksInNewWindow: false,
      }),
    );
    const firstFragments = renderToStaticMarkup(
      React.createElement(PostFragments, {
        id: 1,
        openArticleLinksInNewWindow: false,
      }),
    );

    vi.mocked(api.getArticleNavByIdOrPathname).mockResolvedValueOnce({
      pre: { id: 10, title: "newer-prev" } as any,
      next: { id: 11, title: "newer-next" } as any,
    });
    vi.mocked(api.getArticleFragmentsByIdOrPathname).mockResolvedValueOnce({
      commentCount: 42,
      related: [{ id: 12, title: "related-after" }] as any,
      latest: [{ id: 13, title: "latest-after" }] as any,
      hot: [{ id: 14, title: "hot-after" }] as any,
    });

    const secondBottom = renderToStaticMarkup(
      React.createElement(PostBottom, {
        type: "article",
        id: 1,
        lock: false,
        openArticleLinksInNewWindow: false,
      }),
    );
    const secondFragments = renderToStaticMarkup(
      React.createElement(PostFragments, {
        id: 1,
        openArticleLinksInNewWindow: false,
      }),
    );

    expect(firstBottom).toBe(secondBottom);
    expect(firstFragments).toBe(secondFragments);
    expect(firstBottom).not.toContain("before-change");
    expect(firstBottom).not.toContain("newer-prev");
    expect(firstFragments).not.toContain("related-before");
    expect(firstFragments).not.toContain("related-after");
    expect(firstFragments).not.toContain("42");
    expect(getArticleNavByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleFragmentsByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleEngagementByIdOrPathname).not.toHaveBeenCalled();
  });

  it("does not start engagement reads while server-rendering article subtitles", () => {
    getArticleEngagementByIdOrPathname.mockClear();

    const html = renderToStaticMarkup(
      React.createElement(SubTitle, {
        type: "article",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        catelog: "Architecture",
        enableComment: "true",
        id: 1,
        openArticleLinksInNewWindow: false,
      }),
    );

    expect(html).toContain("2024-01-01");
    expect(getArticleEngagementByIdOrPathname).not.toHaveBeenCalled();
  });
});
