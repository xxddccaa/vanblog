import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticlesByOption = vi.fn();

vi.mock("../api/getArticles", () => ({
  getArticlesByOption,
}));

vi.mock("../utils/getPageProps", () => ({
  getPostPagesProps: vi.fn(),
}));

vi.mock("../utils/renderMarkdown", () => ({
  renderMarkdownToHtml: vi.fn(),
}));

vi.mock("../page-components/post/[id]", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("post static params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prebuilds only the latest 100 posts while keeping dynamic params enabled", async () => {
    getArticlesByOption.mockResolvedValue({
      articles: [
        { id: 1, pathname: "latest" },
        { id: 2, pathname: "" },
      ],
    });

    const route = await import("../app/(rich)/post/[id]/page");
    const params = await route.generateStaticParams();

    expect(route.dynamicParams).toBe(true);
    expect(getArticlesByOption).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      toListView: true,
      sortCreatedAt: "desc",
    });
    expect(params).toEqual([{ id: "latest" }, { id: "2" }]);
  });
});
