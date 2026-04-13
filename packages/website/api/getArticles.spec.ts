import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/loadConfig", () => ({
  config: {
    baseUrl: "https://blog.example.com/",
  },
  getServerFetchOptions: () => ({}),
}));

describe("article api fragments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.isBuild;
  });

  it("reads article engagement from the dedicated short-cache fragment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: {
          viewer: 12,
          visited: 8,
          commentCount: 6,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleEngagementByIdOrPathname } = await import("./getArticles");
    await expect(getArticleEngagementByIdOrPathname("edge-cache")).resolves.toEqual({
      viewer: 12,
      visited: 8,
      commentCount: 6,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/public/article/edge-cache/engagement", {});
  });

  it("keeps article shell reads free of dynamic engagement fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: {
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
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleByIdOrPathname } = await import("./getArticles");
    await expect(getArticleByIdOrPathname("edge-cache")).resolves.toEqual({
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
        copyright: undefined,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/article/edge-cache",
      {},
    );
  });

  it("keeps article listing reads free of dynamic engagement fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        data: {
          total: 1,
          totalWordCount: 1234,
          articles: [
            {
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
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticlesByOption } = await import("./getArticles");
    await expect(
      getArticlesByOption({
        page: 1,
        pageSize: 5,
        withPreviewContent: true,
      }),
    ).resolves.toEqual({
      total: 1,
      totalWordCount: 1234,
      articles: [
        {
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
          copyright: undefined,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/article?page=1&pageSize=5&withPreviewContent=true",
      {},
    );
  });

  it("normalizes article listing query strings so undefined and default flags do not fragment cache keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        data: {
          total: 0,
          articles: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticlesByOption } = await import("./getArticles");
    await getArticlesByOption({
      pageSize: 5,
      page: 2,
      sortTop: undefined,
      category: "",
      tags: undefined,
      withPreviewContent: false,
      toListView: false,
      withWordCount: false,
      sortCreatedAt: "desc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/article?page=2&pageSize=5&sortCreatedAt=desc",
      {},
    );
  });

  it("keeps fragment article collections free of dynamic engagement fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: {
          commentCount: 9,
          related: [
            {
              id: 2,
              title: "related",
              pathname: "related",
              updatedAt: "2026-04-11T00:00:00.000Z",
              createdAt: "2026-04-09T00:00:00.000Z",
              category: "Architecture",
              content: "body",
              private: false,
              tags: ["cache"],
              viewer: 100,
              visited: 50,
              commentCount: 10,
            },
          ],
          latest: [],
          hot: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleFragmentsByIdOrPathname } = await import("./getArticles");
    await expect(getArticleFragmentsByIdOrPathname("edge-cache", 4)).resolves.toEqual({
      commentCount: 9,
      related: [
        {
          id: 2,
          title: "related",
          pathname: "related",
          updatedAt: "2026-04-11T00:00:00.000Z",
          createdAt: "2026-04-09T00:00:00.000Z",
          category: "Architecture",
          content: "body",
          private: false,
          tags: ["cache"],
          author: undefined,
          copyright: undefined,
          top: undefined,
        },
      ],
      latest: [],
      hot: [],
    });
  });

  it("reads post fragments from the dedicated fragment endpoint with a bounded limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: {
          commentCount: 9,
          related: [{ id: 2, title: "related" }],
          latest: [{ id: 3, title: "latest" }],
          hot: [{ id: 4, title: "hot" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleFragmentsByIdOrPathname } = await import("./getArticles");
    await expect(getArticleFragmentsByIdOrPathname("edge-cache", 4)).resolves.toEqual({
      commentCount: 9,
      related: [
        {
          id: 2,
          title: "related",
          pathname: undefined,
          updatedAt: undefined,
          createdAt: undefined,
          category: undefined,
          content: undefined,
          private: false,
          tags: [],
          author: undefined,
          top: undefined,
          copyright: undefined,
        },
      ],
      latest: [
        {
          id: 3,
          title: "latest",
          pathname: undefined,
          updatedAt: undefined,
          createdAt: undefined,
          category: undefined,
          content: undefined,
          private: false,
          tags: [],
          author: undefined,
          top: undefined,
          copyright: undefined,
        },
      ],
      hot: [
        {
          id: 4,
          title: "hot",
          pathname: undefined,
          updatedAt: undefined,
          createdAt: undefined,
          category: undefined,
          content: undefined,
          private: false,
          tags: [],
          author: undefined,
          top: undefined,
          copyright: undefined,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/public/article/edge-cache/fragments?limit=4", {});
  });

  it("reads timeline summary data from the dedicated stable fragment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [
          { year: "2026", articleCount: 6 },
          { year: "2025", articleCount: 4 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getTimelineSummary } = await import("./getArticles");
    await expect(getTimelineSummary()).resolves.toEqual([
      { year: "2026", articleCount: 6 },
      { year: "2025", articleCount: 4 },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/timeline/summary",
      {},
    );
  });

  it("reads category summary data from the dedicated stable fragment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [
          { name: "Architecture", articleCount: 7 },
          { name: "Caching", articleCount: 3 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getCategorySummary } = await import("./getArticles");
    await expect(getCategorySummary()).resolves.toEqual([
      { name: "Architecture", articleCount: 7 },
      { name: "Caching", articleCount: 3 },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/category/summary",
      {},
    );
  });

  it("reads expanded timeline article lists from their dedicated fragment endpoint and strips dynamic counters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: 21,
            title: "timeline-shell",
            pathname: "timeline-shell",
            updatedAt: "2026-04-11T00:00:00.000Z",
            createdAt: "2026-04-09T00:00:00.000Z",
            category: "Architecture",
            content: "body",
            private: false,
            tags: ["cache"],
            viewer: 100,
            visited: 50,
            commentCount: 10,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getTimelineArticlesByYear } = await import("./getArticles");
    await expect(getTimelineArticlesByYear("2026")).resolves.toEqual([
      {
        id: 21,
        title: "timeline-shell",
        pathname: "timeline-shell",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-09T00:00:00.000Z",
        category: "Architecture",
        content: "body",
        private: false,
        tags: ["cache"],
        author: undefined,
        top: undefined,
        copyright: undefined,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/timeline/2026/articles",
      {},
    );
  });

  it("reads expanded category article lists from their dedicated fragment endpoint and strips dynamic counters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: 22,
            title: "category-shell",
            pathname: "category-shell",
            updatedAt: "2026-04-11T00:00:00.000Z",
            createdAt: "2026-04-09T00:00:00.000Z",
            category: "System Design",
            content: "body",
            private: false,
            tags: ["cache"],
            viewer: 100,
            visited: 50,
            commentCount: 10,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getCategoryArticles } = await import("./getArticles");
    await expect(getCategoryArticles("System Design")).resolves.toEqual([
      {
        id: 22,
        title: "category-shell",
        pathname: "category-shell",
        updatedAt: "2026-04-11T00:00:00.000Z",
        createdAt: "2026-04-09T00:00:00.000Z",
        category: "System Design",
        content: "body",
        private: false,
        tags: ["cache"],
        author: undefined,
        top: undefined,
        copyright: undefined,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://blog.example.com/api/public/category/System Design/articles",
      {},
    );
  });

  it("falls back to zeroed engagement data when the fragment request fails", async () => {
    process.env.isBuild = "t";
    const fetchMock = vi.fn().mockRejectedValue(new Error("edge offline"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleEngagementByIdOrPathname } = await import("./getArticles");
    await expect(getArticleEngagementByIdOrPathname("edge-cache")).resolves.toEqual({
      viewer: 0,
      visited: 0,
      commentCount: 0,
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to connect, using default values");
  });

  it("falls back to empty summary shells when summary fragment requests fail during build", async () => {
    process.env.isBuild = "t";
    const fetchMock = vi.fn().mockRejectedValue(new Error("edge offline"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { getTimelineSummary, getCategorySummary } = await import("./getArticles");
    await expect(getTimelineSummary()).resolves.toEqual([]);
    await expect(getCategorySummary()).resolves.toEqual([]);

    expect(consoleSpy).toHaveBeenCalledWith("Failed to connect, using default values");
  });

  it("falls back to empty fragment collections when the fragment request fails", async () => {
    process.env.isBuild = "t";
    const fetchMock = vi.fn().mockRejectedValue(new Error("edge offline"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { getArticleFragmentsByIdOrPathname } = await import("./getArticles");
    await expect(getArticleFragmentsByIdOrPathname("edge-cache", 4)).resolves.toEqual({
      commentCount: 0,
      related: [],
      latest: [],
      hot: [],
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to connect, using default values");
  });
});
