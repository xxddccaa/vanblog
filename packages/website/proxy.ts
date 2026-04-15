import { NextRequest, NextResponse } from "next/server";
import {
  getThemeVariantForPublicHtml,
  hasAuthenticatedCookie,
  hasAuthLikeHeader,
  shouldNormalizePublicHtmlPath,
  stripTrackingSearchParams,
} from "./utils/cacheKeyNormalization";

const appendThemeVaryHeader = (response: NextResponse) => {
  response.headers.append("Vary", "x-vanblog-theme");
  return response;
};

export function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers?.get?.("cookie");

  if (
    hasAuthLikeHeader(request.headers) ||
    hasAuthenticatedCookie(cookieHeader)
  ) {
    return NextResponse.next();
  }

  if (!shouldNormalizePublicHtmlPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const themeVariant = getThemeVariantForPublicHtml(cookieHeader);
  if (themeVariant) {
    requestHeaders.set("x-vanblog-theme", themeVariant);
  } else {
    requestHeaders.delete("x-vanblog-theme");
  }

  const normalized = stripTrackingSearchParams(request.nextUrl);
  if (!normalized.changed) {
    return appendThemeVaryHeader(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
    );
  }

  return appendThemeVaryHeader(NextResponse.redirect(normalized.url, 308));
}

export const config = {
  matcher: ["/:path*"],
};
