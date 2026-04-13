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
  getTagPageProps: vi.fn().mockResolvedValue({
    layoutProps: {
      openArticleLinksInNewWindow: "false",
    },
    authorCardProps: {},
    tags: ["Cloudflare", "Cache"],
  } as any),
}));

vi.mock("../utils/loadConfig", () => ({
  revalidate: {
    revalidate: 60,
  },
}));

describe("tag page cache shell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps tag index static props free of the hot-tag fragment request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const page = await import("../page-modules/tag");
    const result = await page.getStaticProps();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        tags: ["Cloudflare", "Cache"],
      },
      revalidate: 60,
    });
  });

  it("renders tag names without embedding SSR article-count badges", async () => {
    const page = await import("../page-modules/tag");
    const html = renderToStaticMarkup(
      React.createElement(page.default as any, {
        layoutProps: {
          openArticleLinksInNewWindow: "false",
        },
        authorCardProps: {},
        tags: ["Cloudflare", "Cache"],
      }),
    );

    expect(html).toContain("Cloudflare");
    expect(html).toContain("Cache");
    expect(html).toContain("共 2 个标签");
    expect(html).not.toContain("rounded-full");
  });
});
