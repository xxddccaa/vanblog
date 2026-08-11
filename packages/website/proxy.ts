import { NextRequest, NextResponse } from "next/server";
import {
  getThemeVariantForPublicHtml,
  hasAuthenticatedCookie,
  hasAuthLikeHeader,
  shouldNormalizePublicHtmlPath,
  stripTrackingSearchParams,
} from "./utils/cacheKeyNormalization";

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

export function proxy(request: NextRequest) {
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

  if (!["GET", "HEAD"].includes(request.method)) {
    return next();
  }

  const cookieHeader = request.headers?.get?.("cookie");

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
