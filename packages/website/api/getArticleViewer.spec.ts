import { beforeEach, describe, expect, it, vi } from "vitest";
import * as getArticlesModule from "./getArticles";
import { getArticleViewer } from "./getArticleViewer";

describe("getArticleViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads viewer data from the engagement fragment endpoint", async () => {
    vi.spyOn(getArticlesModule, "getArticleEngagementByIdOrPathname").mockResolvedValue({
      viewer: 12,
      visited: 7,
      commentCount: 3,
    });

    await expect(getArticleViewer("edge-cache")).resolves.toEqual({
      viewer: 12,
      visited: 7,
    });
    expect(getArticlesModule.getArticleEngagementByIdOrPathname).toHaveBeenCalledWith("edge-cache");
  });

  it("falls back to zero when the engagement fragment request fails", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    vi
      .spyOn(getArticlesModule, "getArticleEngagementByIdOrPathname")
      .mockRejectedValue(new Error("offline"));

    await expect(getArticleViewer("edge-cache")).resolves.toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith("Failed to connect, using default values");

    consoleSpy.mockRestore();
  });
});
