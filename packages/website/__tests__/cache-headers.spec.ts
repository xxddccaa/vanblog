import { describe, expect, it } from "vitest";

const nextConfig = require("../next.config.js");

const expectListingHeaders = (headers: any[]) =>
  expect(headers).toEqual(
    expect.arrayContaining([
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      {
        key: "CDN-Cache-Control",
        value: "public, s-maxage=3600, stale-while-revalidate=86400",
      },
      {
        key: "Cloudflare-CDN-Cache-Control",
        value: "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    ]),
  );

const expectStableHeaders = (headers: any[]) =>
  expect(headers).toEqual(
    expect.arrayContaining([
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      {
        key: "CDN-Cache-Control",
        value: "public, s-maxage=604800, stale-while-revalidate=86400",
      },
      {
        key: "Cloudflare-CDN-Cache-Control",
        value: "public, s-maxage=604800, stale-while-revalidate=86400",
      },
    ]),
  );

describe("website cache headers", () => {
  it("uses explicit Cloudflare-oriented cache rules for stable, archive, listing, and dynamic public HTML", async () => {
    const rules = await nextConfig.headers();

    const postRule = rules.find((rule: any) => rule.source === "/post/:path*");
    const aboutRule = rules.find((rule: any) => rule.source === "/(about|link)");
    const customPageRule = rules.find((rule: any) => rule.source === "/c/:path*");
    const homeRule = rules.find((rule: any) => rule.source === "/");
    const archiveRule = rules.find((rule: any) => rule.source === "/archive");
    const archiveWildcardRule = rules.find((rule: any) => rule.source === "/archive/:path*");
    const archiveMonthRule = rules.find((rule: any) => rule.source === "/archive/:year/:month");
    const categoryRule = rules.find((rule: any) => rule.source === "/category/:path*");
    const categoryMonthRule = rules.find(
      (rule: any) => rule.source === "/category/:category/archive/:year/:month",
    );
    const tagRule = rules.find((rule: any) => rule.source === "/tag/:path*");
    const tagMonthRule = rules.find((rule: any) => rule.source === "/tag/:tag/archive/:year/:month");
    const timelineRule = rules.find((rule: any) => rule.source === "/timeline");
    const dynamicRule = rules.find((rule: any) => rule.source === "/(moment|nav)");
    const nextStaticRule = rules.find((rule: any) => rule.source === "/_next/static/:path*");
    const fixedAssetRule = rules.find(
      (rule: any) =>
        rule.source ===
        "/:path(background.svg|favicon.ico|initTheme.js|logo.svg|markdown.css|more.png|robot.txt|robots.txt|yly_tools_logo.png)",
    );
    const markdownThemeRule = rules.find((rule: any) => rule.source === "/markdown-themes/:path*");

    expectStableHeaders(postRule.headers);
    expect(aboutRule.headers).toEqual(postRule.headers);
    expect(customPageRule.headers).toEqual(postRule.headers);
    expect(postRule.headers).toEqual(
      expect.arrayContaining([{ key: "Cache-Tag", value: "html-public,html-post" }]),
    );

    expectListingHeaders(homeRule.headers);
    expect(homeRule.headers).toEqual(
      expect.arrayContaining([{ key: "Cache-Tag", value: "html-public,html-listing,home" }]),
    );

    for (const rule of [archiveRule, archiveWildcardRule, categoryRule, tagRule, timelineRule]) {
      expectListingHeaders(rule.headers);
      expect(rule.headers).toEqual(
        expect.arrayContaining([{ key: "Cache-Tag", value: expect.stringContaining("html-listing") }]),
      );
    }

    for (const rule of [archiveMonthRule, categoryMonthRule, tagMonthRule]) {
      expectStableHeaders(rule.headers);
      expect(rule.headers).toEqual(
        expect.arrayContaining([{ key: "Cache-Tag", value: "html-public,html-post,archive-month" }]),
      );
    }

    expect(dynamicRule.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Cache-Tag", value: "html-public,html-dynamic" },
        {
          key: "CDN-Cache-Control",
          value: "public, s-maxage=300, stale-while-revalidate=600",
        },
        {
          key: "Cloudflare-CDN-Cache-Control",
          value: "public, s-maxage=300, stale-while-revalidate=600",
        },
      ]),
    );
    expect(nextStaticRule.headers).toEqual([
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ]);
    expect(fixedAssetRule.headers).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
        {
          key: "CDN-Cache-Control",
          value: "public, s-maxage=86400, stale-while-revalidate=86400",
        },
        {
          key: "Cloudflare-CDN-Cache-Control",
          value: "public, s-maxage=86400, stale-while-revalidate=86400",
        },
      ]),
    );
    expect(markdownThemeRule.headers).toEqual(fixedAssetRule.headers);
    expect(fixedAssetRule.headers.map((header: any) => header.key)).not.toContain("Cache-Tag");
  });

  it("redirects legacy paginated routes to archive or summary entry pages", async () => {
    const redirects = await nextConfig.redirects();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/page/:path*", destination: "/archive", permanent: true },
        {
          source: "/category/:category/page/:path*",
          destination: "/category/:category",
          permanent: true,
        },
        {
          source: "/tag/:tag/page/:path*",
          destination: "/tag/:tag",
          permanent: true,
        },
      ]),
    );
  });

  it("does not rely on surrogate-control for public caching", async () => {
    const rules = await nextConfig.headers();
    const keys = rules.flatMap((rule: any) => rule.headers.map((header: any) => header.key));

    expect(keys).not.toContain("Surrogate-Control");
    expect(keys).toContain("Cloudflare-CDN-Cache-Control");
    expect(keys).not.toContain("Set-Cookie");
    expect(keys).not.toContain("Vary");
  });
});
