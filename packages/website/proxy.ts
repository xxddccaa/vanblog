import { NextRequest, NextResponse } from "next/server";
import {
  getThemeVariantForPublicHtml,
  hasAuthenticatedCookie,
  hasAuthLikeHeader,
  shouldNormalizePublicHtmlPath,
  stripTrackingSearchParams,
} from "./utils/cacheKeyNormalization";
import {
  buildPrivateSiteLoginPath,
  checkPrivateSiteAccess,
  isPrivateSitePagePath,
  PRIVATE_SITE_ACCESS_COOKIE,
  readAccessCookie,
} from "./utils/privateSiteGate";

export const buildContentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "frame-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join("; ");

const applyContentSecurityPolicy = (
  response: NextResponse,
  contentSecurityPolicy: string,
) => {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
};

const appendThemeVaryHeader = (response: NextResponse) => {
  response.headers.append("Vary", "x-vanblog-theme");
  return response;
};

// A private site must never be stored by a shared cache (CDN).
const applyPrivateCacheHeaders = (response: NextResponse) => {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  response.headers.delete("Cache-Tag");
  return response;
};

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const securedRequestHeaders = new Headers(request.headers);
  securedRequestHeaders.set("x-nonce", nonce);
  securedRequestHeaders.set("content-security-policy", contentSecurityPolicy);
  const next = (requestHeaders = securedRequestHeaders) =>
    applyContentSecurityPolicy(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      contentSecurityPolicy,
    );

  const cookieHeader = request.headers?.get?.("cookie");

  if (isPrivateSitePagePath(request.nextUrl.pathname)) {
    const accessToken = readAccessCookie(cookieHeader);
    const access = await checkPrivateSiteAccess(accessToken);
    if (access.privateSite) {
      if (!access.allowed) {
        const loginUrl = new URL(
          buildPrivateSiteLoginPath(request.nextUrl.pathname, request.nextUrl.search),
          request.url,
        );
        const redirect = NextResponse.redirect(loginUrl, 307);
        if (accessToken) {
          // The stored session is no longer valid; drop it so the login page starts clean.
          redirect.cookies.set(PRIVATE_SITE_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
        }
        return applyPrivateCacheHeaders(
          applyContentSecurityPolicy(redirect, contentSecurityPolicy),
        );
      }
      return applyPrivateCacheHeaders(next());
    }
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return next();
  }

  if (
    hasAuthLikeHeader(request.headers) ||
    hasAuthenticatedCookie(cookieHeader)
  ) {
    return next();
  }

  if (!shouldNormalizePublicHtmlPath(request.nextUrl.pathname)) {
    return next();
  }

  const requestHeaders = new Headers(securedRequestHeaders);
  const themeVariant = getThemeVariantForPublicHtml(cookieHeader);
  if (themeVariant) {
    requestHeaders.set("x-vanblog-theme", themeVariant);
  } else {
    requestHeaders.delete("x-vanblog-theme");
  }

  const normalized = stripTrackingSearchParams(request.nextUrl);
  if (!normalized.changed) {
    return appendThemeVaryHeader(
      next(requestHeaders),
    );
  }

  return applyContentSecurityPolicy(
    appendThemeVaryHeader(NextResponse.redirect(normalized.url, 308)),
    contentSecurityPolicy,
  );
}

export const config = {
  matcher: ["/:path*"],
};
