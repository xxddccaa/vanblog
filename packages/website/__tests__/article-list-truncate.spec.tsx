import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

// react-tiny-popover 在关闭态下只渲染子元素（气泡内容走 portal，仅打开时挂载）。
// 这里用直通 mock 保证 SSR 下拿到标题 span 本身，专注校验截断样式契约。
vi.mock("react-tiny-popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  ArrowContainer: ({ children }: { children: React.ReactNode }) => children,
}));

const LONG_TITLE =
  "这是一个非常非常非常长的文章标题用于验证单行省略与悬停完整标题的展示效果";

const articles = [
  { id: 1, title: LONG_TITLE, createdAt: "2026-01-01T00:00:00.000Z" },
] as any;

describe("ArticleList truncateTitle", () => {
  it("单行省略：truncateTitle 时标题套用 truncate 且容器加 min-w-0，完整标题仍在 DOM", async () => {
    const { default: ArticleList } = await import("../components/ArticleList");
    const html = renderToStaticMarkup(
      React.createElement(ArticleList, {
        articles,
        openArticleLinksInNewWindow: false,
        truncateTitle: true,
      }),
    );
    expect(html).toContain("truncate");
    expect(html).toContain("min-w-0");
    expect(html).toContain(LONG_TITLE);
  });

  it("默认不截断：不传 truncateTitle 时不加 truncate / min-w-0，标题按原样多行渲染", async () => {
    const { default: ArticleList } = await import("../components/ArticleList");
    const html = renderToStaticMarkup(
      React.createElement(ArticleList, {
        articles,
        openArticleLinksInNewWindow: false,
      }),
    );
    expect(html).not.toContain("truncate");
    expect(html).not.toContain("min-w-0");
    expect(html).toContain(LONG_TITLE);
  });
});
