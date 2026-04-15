import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicMeta = vi.fn().mockResolvedValue({
  version: "dev",
  meta: {
    siteInfo: {
      payAliPay: "/ali.png",
      payWechat: "/wechat.png",
      payAliPayDark: "/ali-dark.png",
      payWechatDark: "/wechat-dark.png",
      author: "Site Author",
    },
  },
});

const getArticleByIdOrPathname = vi.fn().mockResolvedValue({
  article: {
    id: 7,
    title: "Edge Cache Post",
    pathname: "edge-cache",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdAt: "2026-04-09T00:00:00.000Z",
    category: "Architecture",
    content: "post body",
    private: false,
    tags: ["cache"],
    author: "Article Author",
    top: 0,
  },
});

const getArticleNavByIdOrPathname = vi.fn();
const getArticleEngagementByIdOrPathname = vi.fn();
const getArticleFragmentsByIdOrPathname = vi.fn();
const getArticlesByOption = vi.fn().mockResolvedValue({
  articles: [
    {
      id: 7,
      pathname: "edge-cache",
    },
  ],
});

vi.mock("../api/getAllData", () => ({
  defaultMenu: [],
  getPublicMeta,
}));

vi.mock("../api/getArticles", () => ({
  getArticleByIdOrPathname,
  getArticleNavByIdOrPathname,
  getArticleEngagementByIdOrPathname,
  getArticleFragmentsByIdOrPathname,
  getArticlesByOption,
}));

vi.mock("../utils/getLayoutProps", () => ({
  getLayoutProps: vi.fn().mockReturnValue({
    siteName: "VanBlog",
    showSubMenu: "false",
    showEditButton: "false",
    showExpirationReminder: "true",
    copyrightAggreement: "CC BY-NC-SA 4.0",
    openArticleLinksInNewWindow: "false",
    enableComment: "true",
    showDonateButton: "true",
    showCopyRight: "true",
    codeMaxLines: 12,
        articleWidthMode: "standard",
  } as any),
  getAuthorCardShellProps: vi.fn().mockReturnValue({
    author: 'Site Author',
  }),
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("../components/PostCard", () => ({
  default: ({ title, type }: { title: string; type: string }) =>
    React.createElement("article", { "data-type": type }, title),
}));

vi.mock("../components/Toc", () => ({
  default: () => React.createElement("aside", null, "toc"),
}));

vi.mock("../utils/hasToc", () => ({
  hasToc: vi.fn().mockReturnValue(false),
}));

vi.mock("../utils/loadConfig", () => ({
  revalidate: {
    revalidate: 60,
  },
}));

describe("post page cache shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds post page props from the article shell without preloading nav or engagement fragments", async () => {
    const { getPostPagesProps } = await import("../utils/getPageProps");

    const result = await getPostPagesProps("edge-cache");

    expect(result).toEqual({
      layoutProps: {
        siteName: "VanBlog",
        showSubMenu: "false",
        showEditButton: "false",
        showExpirationReminder: "true",
        copyrightAggreement: "CC BY-NC-SA 4.0",
        openArticleLinksInNewWindow: "false",
        enableComment: "true",
        showDonateButton: "true",
        showCopyRight: "true",
        codeMaxLines: 12,
        articleWidthMode: "standard",
      },
      article: {
        id: 7,
        title: "Edge Cache Post",
        pathname: "edge-cache",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-09T00:00:00.000Z",
        category: "Architecture",
        content: "post body",
        private: false,
        tags: ["cache"],
        author: "Article Author",
        top: 0,
      },
      pay: ["/ali.png", "/wechat.png"],
      payDark: ["/ali-dark.png", "/wechat-dark.png"],
      author: "Article Author",
      showSubMenu: "false",
    });
    expect(getArticleByIdOrPathname).toHaveBeenCalledWith("edge-cache");
    expect(getArticleNavByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleEngagementByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleFragmentsByIdOrPathname).not.toHaveBeenCalled();
  });

  it("keeps post static props free of nav and engagement fragment fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../page-modules/post/[id]");
    const result = await page.getStaticProps({ params: { id: "edge-cache" } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: {
        layoutProps: {
          siteName: "VanBlog",
          showSubMenu: "false",
          showEditButton: "false",
          showExpirationReminder: "true",
          copyrightAggreement: "CC BY-NC-SA 4.0",
          openArticleLinksInNewWindow: "false",
          enableComment: "true",
          showDonateButton: "true",
          showCopyRight: "true",
          codeMaxLines: 12,
        articleWidthMode: "standard",
        },
        article: {
          id: 7,
          title: "Edge Cache Post",
          pathname: "edge-cache",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Architecture",
          content: "post body",
          private: false,
          tags: ["cache"],
          author: "Article Author",
          top: 0,
        },
        pay: ["/ali.png", "/wechat.png"],
        payDark: ["/ali-dark.png", "/wechat-dark.png"],
        author: "Article Author",
        showSubMenu: "false",
      },
      revalidate: 60,
    });
    expect(getArticleNavByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleEngagementByIdOrPathname).not.toHaveBeenCalled();
    expect(getArticleFragmentsByIdOrPathname).not.toHaveBeenCalled();
  });

  it("renders the post page shell from the article payload while leaving async fragments to the client", async () => {
    const page = await import("../page-modules/post/[id]");
    const html = renderToStaticMarkup(
      React.createElement(page.default as any, {
        layoutProps: {
          siteName: "VanBlog",
          showSubMenu: "false",
          showEditButton: "false",
          showExpirationReminder: "true",
          copyrightAggreement: "CC BY-NC-SA 4.0",
          openArticleLinksInNewWindow: "false",
          enableComment: "true",
          showDonateButton: "true",
          showCopyRight: "true",
          codeMaxLines: 12,
        articleWidthMode: "standard",
        },
        article: {
          id: 7,
          title: "Edge Cache Post",
          pathname: "edge-cache",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Architecture",
          content: "post body",
          private: false,
          tags: ["cache"],
          author: "Article Author",
          top: 0,
        },
        pay: ["/ali.png", "/wechat.png"],
        payDark: ["/ali-dark.png", "/wechat-dark.png"],
        author: "Article Author",
        showSubMenu: "false",
      }),
    );

    expect(html).toContain("Edge Cache Post");
    expect(html).toContain('data-type="article"');
    expect(html).not.toContain("before-change");
    expect(html).not.toContain("related-before");
  });

  it("keeps post page HTML stable even if dynamic counters change on the article payload", async () => {
    const page = await import("../page-modules/post/[id]");

    const baseProps = {
      layoutProps: {
        siteName: "VanBlog",
        showSubMenu: "false",
        showEditButton: "false",
        showExpirationReminder: "true",
        copyrightAggreement: "CC BY-NC-SA 4.0",
        openArticleLinksInNewWindow: "false",
        enableComment: "true",
        showDonateButton: "true",
        showCopyRight: "true",
        codeMaxLines: 12,
        articleWidthMode: "standard",
      },
      pay: ["/ali.png", "/wechat.png"],
      payDark: ["/ali-dark.png", "/wechat-dark.png"],
      author: "Article Author",
      showSubMenu: "false" as const,
    };

    const firstHtml = renderToStaticMarkup(
      React.createElement(page.default as any, {
        ...baseProps,
        article: {
          id: 7,
          title: "Edge Cache Post",
          pathname: "edge-cache",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Architecture",
          content: "post body",
          private: false,
          tags: ["cache"],
          author: "Article Author",
          top: 0,
          viewer: 1,
          visited: 2,
          commentCount: 3,
        } as any,
      }),
    );

    const secondHtml = renderToStaticMarkup(
      React.createElement(page.default as any, {
        ...baseProps,
        article: {
          id: 7,
          title: "Edge Cache Post",
          pathname: "edge-cache",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Architecture",
          content: "post body",
          private: false,
          tags: ["cache"],
          author: "Article Author",
          top: 0,
          viewer: 999,
          visited: 888,
          commentCount: 777,
        } as any,
      }),
    );

    expect(firstHtml).toBe(secondHtml);
    expect(firstHtml).not.toContain("777");
    expect(firstHtml).not.toContain("999");
    expect(firstHtml).not.toContain("888");
  });
});
