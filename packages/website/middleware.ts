import { NextRequest, NextResponse } from "next/server";
import {
  hasAuthenticatedCookie,
  hasAuthLikeHeader,
  shouldNormalizePublicHtmlPath,
  stripTrackingSearchParams,
} from "./utils/cacheKeyNormalization";

export function middleware(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return NextResponse.next();
  }

  if (
    hasAuthLikeHeader(request.headers) ||
    hasAuthenticatedCookie(request.headers?.get?.("cookie"))
  ) {
    return NextResponse.next();
  }

  if (!shouldNormalizePublicHtmlPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const normalized = stripTrackingSearchParams(request.nextUrl);
  if (!normalized.changed) {
    return NextResponse.next();
  }

  return NextResponse.redirect(normalized.url, 308);
}

export const config = {
  matcher: ["/:path*"],
};
