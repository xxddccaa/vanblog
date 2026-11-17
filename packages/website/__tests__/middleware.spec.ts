import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildContentSecurityPolicy, proxy, config } from "../proxy";
import { resetPrivateSiteGateCache } from "../utils/privateSiteGate";

const stubPrivateSiteAccess = (data: { privateSite: boolean; allowed: boolean }) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ statusCode: 200, data }) })),
  );

describe("website proxy cache normalization", () => {
  beforeEach(() => {
    resetPrivateSiteGateCache();
    stubPrivateSiteAccess({ privateSite: false, allowed: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses nonce-based script CSP without unsafe script fallbacks", async () => {
    const policy = buildContentSecurityPolicy("test-nonce");

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it("redirects public html requests to a tracking-param-free url", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x&fbclid=y&page=2"),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe(
      "https://example.com/post/stable-shell?page=2",
    );
  });

  it("redirects public html requests to a stable query-param order", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/tag/cloudflare?sort=desc&page=2"),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe(
      "https://example.com/tag/cloudflare?page=2&sort=desc",
    );
  });

  it("redirects stable public shell routes like about, link, and custom pages", async () => {
    const aboutResult = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/about?utm_source=x"),
    } as any);
    const linkResult = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/link?gclid=y"),
    } as any);
    const customPageResult = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/c/cloudflare-cache?fbclid=z"),
    } as any);

    expect(aboutResult.status).toBe(308);
    expect(aboutResult.headers.get("location")).toBe("https://example.com/about");
    expect(linkResult.status).toBe(308);
    expect(linkResult.headers.get("location")).toBe("https://example.com/link");
    expect(customPageResult.status).toBe(308);
    expect(customPageResult.headers.get("location")).toBe(
      "https://example.com/c/cloudflare-cache",
    );
  });

  it("passes through api routes without redirecting", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/api/public/article/1?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes through non-html aliases and static files without redirecting", async () => {
    const feedResult = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/feed.xml?utm_source=x"),
      headers: new Headers(),
    } as any);
    const robotsResult = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/robots.txt?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(feedResult.status).toBe(200);
    expect(feedResult.headers.get("x-middleware-next")).toBe("1");
    expect(robotsResult.status).toBe(200);
    expect(robotsResult.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes through clean public html urls", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/tag/cloudflare?page=2"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(result.headers.get("content-security-policy")).toContain("script-src");
    expect(result.headers.get("x-middleware-override-headers")).toContain("x-nonce");
  });

  it("forwards a normalized theme variant header for anonymous public html requests", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell"),
      headers: new Headers({
        cookie: "theme=auto; locale=zh-CN",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(result.headers.get("x-middleware-override-headers")).toContain("x-vanblog-theme");
    expect(result.headers.get("x-middleware-request-x-vanblog-theme")).toBe("dark");
  });

  it("also redirects HEAD requests for cacheable dynamic public html", async () => {
    const result = await proxy({
      method: "HEAD",
      nextUrl: new URL("https://example.com/moment?utm_source=x&gclid=y"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe("https://example.com/moment");
  });

  it("skips normalization for non-read requests", async () => {
    const result = await proxy({
      method: "POST",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("registers a catch-all matcher so normalization runs before public page rendering", async () => {
    expect(config).toEqual({
      matcher: ["/:path*"],
    });
  });

  it("bypasses normalization when auth-like headers are present", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers({
        authorization: "Bearer secret",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("bypasses normalization when authenticated cookies are present", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers({
        cookie: "theme=dark; token=secret",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("also bypasses normalization when sessionid cookies are present", async () => {
    const result = await proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers({
        cookie: "theme=dark; sessionid=secret",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("website proxy private site gate", () => {
  beforeEach(() => {
    resetPrivateSiteGateCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects anonymous visitors of a private site to the admin login", async () => {
    stubPrivateSiteAccess({ privateSite: true, allowed: false });
    const result = await proxy({
      method: "GET",
      url: "https://example.com/post/secret?x=1",
      nextUrl: new URL("https://example.com/post/secret?x=1"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(
      "https://example.com/admin/user/login?return=%2Fpost%2Fsecret%3Fx%3D1",
    );
    expect(result.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("serves logged-in visitors of a private site without shared caching", async () => {
    stubPrivateSiteAccess({ privateSite: true, allowed: true });
    const result = await proxy({
      method: "GET",
      url: "https://example.com/post/secret",
      nextUrl: new URL("https://example.com/post/secret"),
      headers: new Headers({ cookie: "vanblog_token=good" }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("cdn-cache-control")).toBe("no-store");
    expect(result.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
  });

  it("does not gate Next internals and static files", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await proxy({
      method: "GET",
      url: "https://example.com/_next/static/chunk.js",
      nextUrl: new URL("https://example.com/_next/static/chunk.js"),
      headers: new Headers(),
    } as any);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

