import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPublicMeta = vi.fn();
const getMoments = vi.fn();
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

vi.mock("../api/getMoments", () => ({
  getMoments,
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
  getServerBaseUrl: () => "https://blog.example.com/",
  getServerFetchOptions: () => ({ next: { revalidate: 60 } }),
}));

const publicMeta = {
  totalArticles: 1,
  tags: [],
  meta: {
    links: [],
    about: { content: "" },
    rewards: [],
    categories: [],
    siteInfo: {
      author: "author",
      baseUrl: "https://blog.example.com",
    },
  },
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe("page props request concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getLayoutProps.mockReturnValue({
      siteName: "VanBlog",
      showSubMenu: "false",
    });
    getAuthorCardShellProps.mockReturnValue({ author: "author" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts independent layout and page requests together", async () => {
    const pageProps = await import("../utils/getPageProps");
    const summary = { totalArticles: 0, years: [] };
    const cases = [
      {
        invoke: () => pageProps.getArchivePageProps(),
        request: getArchiveSummary,
        value: summary,
      },
      {
        invoke: () => pageProps.getArchiveYearPageProps("2026"),
        request: getArchiveSummary,
        value: summary,
      },
      {
        invoke: () => pageProps.getArchiveMonthPageProps("2026", "08"),
        request: getArchiveMonthArticles,
        value: [],
      },
      {
        invoke: () => pageProps.getTimeLinePageProps(),
        request: getTimelineSummary,
        value: [],
      },
      {
        invoke: () => pageProps.getCategoryPageProps(),
        request: getCategorySummary,
        value: [],
      },
      {
        invoke: () => pageProps.getPostPagesProps("post"),
        request: getArticleByIdOrPathname,
        value: { article: null },
      },
      {
        invoke: () => pageProps.getCategoryArchivePageProps("category"),
        request: getCategoryArchiveSummary,
        value: summary,
      },
      {
        invoke: () =>
          pageProps.getCategoryArchiveYearPageProps("category", "2026"),
        request: getCategoryArchiveSummary,
        value: summary,
      },
      {
        invoke: () =>
          pageProps.getCategoryArchiveMonthPageProps(
            "category",
            "2026",
            "08",
          ),
        request: getCategoryArchiveMonthArticles,
        value: [],
      },
      {
        invoke: () => pageProps.getTagArchivePageProps("tag"),
        request: getTagArchiveSummary,
        value: summary,
      },
      {
        invoke: () => pageProps.getTagArchiveYearPageProps("tag", "2026"),
        request: getTagArchiveSummary,
        value: summary,
      },
      {
        invoke: () =>
          pageProps.getTagArchiveMonthPageProps("tag", "2026", "08"),
        request: getTagArchiveMonthArticles,
        value: [],
      },
    ];

    for (const testCase of cases) {
      vi.clearAllMocks();
      getLayoutProps.mockReturnValue({
        siteName: "VanBlog",
        showSubMenu: "false",
      });
      getAuthorCardShellProps.mockReturnValue({ author: "author" });
      const metaResult = deferred<typeof publicMeta>();
      const pageResult = deferred<any>();
      getPublicMeta.mockReturnValueOnce(metaResult.promise);
      testCase.request.mockReturnValueOnce(pageResult.promise);

      const resultPromise = testCase.invoke();

      expect(getPublicMeta).toHaveBeenCalledTimes(1);
      expect(testCase.request).toHaveBeenCalledTimes(1);

      metaResult.resolve(publicMeta);
      pageResult.resolve(testCase.value);
      await resultPromise;
    }
  });

  it("keeps layout data when the moment request fails", async () => {
    const pageProps = await import("../utils/getPageProps");
    const metaResult = deferred<typeof publicMeta>();
    const momentResult = deferred<any>();
    getPublicMeta.mockReturnValueOnce(metaResult.promise);
    getMoments.mockReturnValueOnce(momentResult.promise);

    const resultPromise = pageProps.getMomentPageProps();

    expect(getPublicMeta).toHaveBeenCalledTimes(1);
    expect(getMoments).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sortCreatedAt: "desc",
    });

    momentResult.reject(new Error("moment unavailable"));
    metaResult.resolve(publicMeta);

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({
        siteName: "VanBlog",
        initialMoments: [],
        initialTotal: 0,
      }),
    );
  });

  it("retries public meta when the initial moment layout request fails", async () => {
    const pageProps = await import("../utils/getPageProps");
    getPublicMeta
      .mockRejectedValueOnce(new Error("temporary meta failure"))
      .mockResolvedValueOnce(publicMeta);
    getMoments.mockResolvedValueOnce({
      moments: [{ id: 1, content: "ignored after retry" }],
      total: 1,
    });

    const result = await pageProps.getMomentPageProps();

    expect(getPublicMeta).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        siteName: "VanBlog",
        initialMoments: [],
        initialTotal: 0,
      }),
    );
  });

  it("starts public meta and nav data together and preserves nav fallback", async () => {
    const pageProps = await import("../utils/getPageProps");
    const metaResult = deferred<typeof publicMeta>();
    const navResponse = deferred<any>();
    const fetchMock = vi.fn().mockReturnValue(navResponse.promise);
    vi.stubGlobal("fetch", fetchMock);
    getPublicMeta.mockReturnValueOnce(metaResult.promise);

    const resultPromise = pageProps.getNavPageProps();

    expect(getPublicMeta).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    navResponse.reject(new Error("nav unavailable"));
    metaResult.resolve(publicMeta);

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({
        initialNavData: { categories: [], tools: [] },
      }),
    );
  });
});
