import { describe, expect, it } from "vitest";
import {
  getThemeVariantForPublicHtml,
  hasAuthenticatedCookie,
  hasAuthLikeHeader,
  isTrackingQueryParam,
  shouldNormalizePublicHtmlPath,
  stripTrackingSearchParams,
} from "../utils/cacheKeyNormalization";

const nextConfig = require("../next.config.js");

const getRouteGroups = (paths: string[]) => {
  const groups = new Set<string>();

  for (const path of paths) {
    if (path === "/") {
      groups.add("home");
    }
    if (path.includes("post")) {
      groups.add("post");
    }
    if (path.includes("archive")) {
      groups.add("archive");
    }
    if (path.includes("category")) {
      groups.add("category");
    }
    if (path.includes("tag")) {
      groups.add("tag");
    }
    if (path.includes("timeline")) {
      groups.add("timeline");
    }
    if (path.includes("about")) {
      groups.add("about");
    }
    if (path.includes("link")) {
      groups.add("link");
    }
    if (path.includes("/c/")) {
      groups.add("custom-page");
    }
    if (path.includes("moment")) {
      groups.add("moment");
    }
    if (path.includes("nav")) {
      groups.add("nav");
    }
  }

  return Array.from(groups).sort();
};

describe("cache key normalization", () => {
  it("identifies marketing params that should not split the public cache key", () => {
    expect(isTrackingQueryParam("utm_source")).toBe(true);
    expect(isTrackingQueryParam("utm_campaign")).toBe(true);
    expect(isTrackingQueryParam("fbclid")).toBe(true);
    expect(isTrackingQueryParam("gclid")).toBe(true);
    expect(isTrackingQueryParam("msclkid")).toBe(true);
    expect(isTrackingQueryParam("page")).toBe(false);
  });

  it("detects auth-like cookies and headers that should bypass public cache normalization", () => {
    expect(hasAuthenticatedCookie("theme=dark; locale=zh-CN")).toBe(false);
    expect(hasAuthenticatedCookie("theme=dark; token=secret")).toBe(true);
    expect(hasAuthenticatedCookie("theme=dark; sessionid=secret")).toBe(true);
    expect(hasAuthenticatedCookie("__Secure-next-auth.session-token=secret")).toBe(true);

    expect(hasAuthLikeHeader(new Headers())).toBe(false);
    expect(hasAuthLikeHeader(new Headers({ authorization: "Bearer secret" }))).toBe(true);
    expect(hasAuthLikeHeader(new Headers({ "x-api-key": "secret" }))).toBe(true);
    expect(hasAuthLikeHeader(new Headers({ "x-debug-auth": "secret" }))).toBe(true);
  });

  it("normalizes the public html theme variant from anonymous cookies", () => {
    expect(getThemeVariantForPublicHtml("theme=dark; locale=zh-CN")).toBe("dark");
    expect(getThemeVariantForPublicHtml("theme=light; locale=zh-CN")).toBe("light");
    expect(getThemeVariantForPublicHtml("theme=auto; locale=zh-CN")).toBe("dark");
    expect(getThemeVariantForPublicHtml("locale=zh-CN")).toBeNull();
  });

  it("only normalizes public HTML paths instead of api or static requests", () => {
    expect(shouldNormalizePublicHtmlPath("/")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/post/edge-cache")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/archive")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/archive/2026/04")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/about")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/link")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/c/cloudflare-cache")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/category")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/tag")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/category/system-design")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/moment")).toBe(true);
    expect(shouldNormalizePublicHtmlPath("/nav")).toBe(true);

    expect(shouldNormalizePublicHtmlPath("/api/public/article/1")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/admin")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/_next/static/chunk.js")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/static/img/logo.png")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/feed.xml")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/feed.json")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/atom.xml")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/sitemap.xml")).toBe(false);
    expect(shouldNormalizePublicHtmlPath("/robots.txt")).toBe(false);
  });

  it("strips tracking params while preserving real pagination or filtering params", () => {
    const original = new URL(
      "https://example.com/archive/2026/04?page=2&utm_source=x&fbclid=y&gclid=z",
    );

    const normalized = stripTrackingSearchParams(original);

    expect(normalized.changed).toBe(true);
    expect(normalized.url.toString()).toBe("https://example.com/archive/2026/04?page=2");
  });

  it("sorts remaining public query params into a stable order after removing tracking noise", () => {
    const original = new URL(
      "https://example.com/tag/cloudflare?sort=desc&utm_source=x&page=2&keyword=edge",
    );

    const normalized = stripTrackingSearchParams(original);

    expect(normalized.changed).toBe(true);
    expect(normalized.url.toString()).toBe(
      "https://example.com/tag/cloudflare?keyword=edge&page=2&sort=desc",
    );
  });

  it("keeps clean public urls untouched", () => {
    const original = new URL("https://example.com/post/stable-shell");
    const normalized = stripTrackingSearchParams(original);

    expect(normalized.changed).toBe(false);
    expect(normalized.url.toString()).toBe("https://example.com/post/stable-shell");
  });

  it("keeps already-normalized public urls untouched", () => {
    const original = new URL("https://example.com/tag/cloudflare?keyword=edge&page=2&sort=desc");
    const normalized = stripTrackingSearchParams(original);

    expect(normalized.changed).toBe(false);
    expect(normalized.url.toString()).toBe(
      "https://example.com/tag/cloudflare?keyword=edge&page=2&sort=desc",
    );
  });

  it("stays aligned with next.config.js public html cache groups", async () => {
    const rules = await nextConfig.headers();
    const publicHtmlSources = rules
      .filter((rule: any) =>
        [
          "/post/:path*",
          "/(about|link)",
          "/c/:path*",
          "/",
          "/archive",
          "/archive/:path*",
          "/category/:path*",
          "/tag/:path*",
          "/timeline",
          "/(moment|nav)",
        ].includes(rule.source),
      )
      .map((rule: any) => rule.source);

    const normalizedGroups = getRouteGroups([
      "/",
      "/post/edge-cache",
      "/archive",
      "/archive/2026/04",
      "/about",
      "/link",
      "/c/cloudflare-cache",
      "/category",
      "/category/system-design",
      "/tag",
      "/tag/cloudflare",
      "/timeline",
      "/moment",
      "/nav",
    ]);

    expect(getRouteGroups(publicHtmlSources)).toEqual(normalizedGroups);
  });
});
