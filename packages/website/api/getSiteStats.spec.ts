import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteStats } from "./getSiteStats";

describe("site stats api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads site stats from the dedicated public fragment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        data: {
          postNum: 12,
          tagNum: 8,
          categoryNum: 5,
          totalWordCount: 9999,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSiteStats()).resolves.toEqual({
      postNum: 12,
      tagNum: 8,
      categoryNum: 5,
      totalWordCount: 9999,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/public/site-stats");
  });

  it("fails fast when the public fragment endpoint returns an invalid payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        statusCode: 500,
        data: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSiteStats()).rejects.toThrow("Failed to load site stats");
  });
});
