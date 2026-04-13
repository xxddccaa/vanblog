import { describe, expect, it } from "vitest";

import { proxy, config } from "../proxy";

describe("website proxy cache normalization", () => {
  it("redirects public html requests to a tracking-param-free url", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x&fbclid=y&page=2"),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe(
      "https://example.com/post/stable-shell?page=2",
    );
  });

  it("redirects public html requests to a stable query-param order", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/tag/cloudflare?sort=desc&page=2"),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe(
      "https://example.com/tag/cloudflare?page=2&sort=desc",
    );
  });

  it("redirects stable public shell routes like about, link, and custom pages", () => {
    const aboutResult = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/about?utm_source=x"),
    } as any);
    const linkResult = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/link?gclid=y"),
    } as any);
    const customPageResult = proxy({
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

  it("passes through api routes without redirecting", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/api/public/article/1?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes through non-html aliases and static files without redirecting", () => {
    const feedResult = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/feed.xml?utm_source=x"),
      headers: new Headers(),
    } as any);
    const robotsResult = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/robots.txt?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(feedResult.status).toBe(200);
    expect(feedResult.headers.get("x-middleware-next")).toBe("1");
    expect(robotsResult.status).toBe(200);
    expect(robotsResult.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes through clean public html urls", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/tag/cloudflare?page=2"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("also redirects HEAD requests for cacheable dynamic public html", () => {
    const result = proxy({
      method: "HEAD",
      nextUrl: new URL("https://example.com/moment?utm_source=x&gclid=y"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe("https://example.com/moment");
  });

  it("skips normalization for non-read requests", () => {
    const result = proxy({
      method: "POST",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers(),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("registers a catch-all matcher so normalization runs before public page rendering", () => {
    expect(config).toEqual({
      matcher: ["/:path*"],
    });
  });

  it("bypasses normalization when auth-like headers are present", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers({
        authorization: "Bearer secret",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("bypasses normalization when authenticated cookies are present", () => {
    const result = proxy({
      method: "GET",
      nextUrl: new URL("https://example.com/post/stable-shell?utm_source=x"),
      headers: new Headers({
        cookie: "theme=dark; token=secret",
      }),
    } as any);

    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it("also bypasses normalization when sessionid cookies are present", () => {
    const result = proxy({
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
