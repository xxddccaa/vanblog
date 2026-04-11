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

vi.mock("../utils/getPageProps", () => ({
  getCategoryPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    summaries: [
      { name: "Architecture", articleCount: 7 },
      { name: "Caching", articleCount: 3 },
    ],
  } as any),
  getTimeLinePageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    summaries: [
      { year: "2026", articleCount: 6 },
      { year: "2025", articleCount: 4 },
    ],
  } as any),
}));

vi.mock("../utils/loadConfig", () => ({
  revalidate: {
    revalidate: 60,
  },
}));

describe("summary page cache shells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps category static props free of expanded article fragment requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../pages/category");
    const result = await page.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        summaries: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
      },
      revalidate: 60,
    });
  });

  it("renders the category page as a stable summary shell", async () => {
    const page = await import("../pages/category");
    const html = renderToStaticMarkup(
      React.createElement(page.default as any, {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        summaries: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
      }),
    );

    expect(html).toContain("Architecture");
    expect(html).toContain("7 篇文章");
    expect(html).not.toContain("正在加载文章列表");
    expect(html).not.toContain("category-loaded-article");
    expect(html).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(html).not.toContain("9999 字");
  });

  it("keeps timeline static props free of expanded article fragment requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../pages/timeline");
    const result = await page.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        summaries: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
      },
      revalidate: 60,
    });
  });

  it("renders the timeline page as a stable summary shell", async () => {
    const page = await import("../pages/timeline");
    const html = renderToStaticMarkup(
      React.createElement(page.default as any, {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        summaries: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
      }),
    );

    expect(html).toContain("2026");
    expect(html).toContain("6 篇文章");
    expect(html).not.toContain("正在加载文章列表");
    expect(html).not.toContain("timeline-loaded-article");
    expect(html).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(html).not.toContain("9999 字");
  });
});
