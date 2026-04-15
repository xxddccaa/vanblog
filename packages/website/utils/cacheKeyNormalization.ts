import { getThemePreferenceFromCookie } from "./themeBoot";

const TRACKING_QUERY_PARAM_KEYS = new Set(["fbclid", "gclid", "msclkid"]);
const AUTH_COOKIE_NAMES = new Set([
  "auth",
  "authorization",
  "connect.sid",
  "next-auth.session-token",
  "session",
  "session-id",
  "session_id",
  "sessionid",
  "token",
]);
const AUTH_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "token",
  "x-token",
  "x-api-key",
  "api-key",
]);

const PUBLIC_HTML_EXACT_PATHS = new Set([
  "/",
  "/archive",
  "/about",
  "/link",
  "/timeline",
  "/moment",
  "/nav",
  "/category",
  "/tag",
]);

const PUBLIC_HTML_PREFIXES = [
  "/post/",
  "/archive/",
  "/category/",
  "/tag/",
  "/c/",
  "/moment/",
  "/nav/",
];

const NON_HTML_PREFIXES = [
  "/api/",
  "/admin",
  "/_next/",
  "/static/",
  "/comment",
  "/ui",
  "/user",
  "/token",
  "/db",
  "/oauth",
];

const STATIC_FILE_PATTERN = /\.[a-z0-9]+$/i;

export const isTrackingQueryParam = (key: string) =>
  key.startsWith("utm_") || TRACKING_QUERY_PARAM_KEYS.has(key);

export const hasAuthenticatedCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const [name] = part.split("=");
      const normalizedName = name?.trim().toLowerCase();
      if (!normalizedName) {
        return false;
      }
      return (
        AUTH_COOKIE_NAMES.has(normalizedName) ||
        normalizedName.endsWith(".token") ||
        normalizedName.endsWith("_token") ||
        normalizedName.endsWith("-token") ||
        normalizedName.includes("session-token") ||
        normalizedName.startsWith("__secure-next-auth") ||
        normalizedName.startsWith("__host-next-auth")
      );
    });
};

export const hasAuthLikeHeader = (headers?: Headers | null) => {
  if (!headers) {
    return false;
  }

  for (const rawName of Array.from(headers.keys())) {
    const name = rawName.toLowerCase();
    if (AUTH_HEADER_NAMES.has(name)) {
      return true;
    }
    if (name.startsWith("x-") && (name.includes("token") || name.includes("auth"))) {
      return true;
    }
    if (name.endsWith("-token") || name.endsWith("_token") || name.includes("api-key")) {
      return true;
    }
  }

  return false;
};

export const getThemeVariantForPublicHtml = (cookieHeader?: string | null) =>
  getThemePreferenceFromCookie(cookieHeader);

export const shouldNormalizePublicHtmlPath = (pathname: string) => {
  if (!pathname) {
    return false;
  }

  if (STATIC_FILE_PATTERN.test(pathname)) {
    return false;
  }

  if (NON_HTML_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return (
    PUBLIC_HTML_EXACT_PATHS.has(pathname) ||
    PUBLIC_HTML_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
};

export const stripTrackingSearchParams = (url: URL) => {
  const nextUrl = new URL(url.toString());
  const originalEntries = Array.from(nextUrl.searchParams.entries());
  let changed = false;

  for (const key of Array.from(nextUrl.searchParams.keys())) {
    if (isTrackingQueryParam(key)) {
      nextUrl.searchParams.delete(key);
      changed = true;
    }
  }

  const normalizedEntries = Array.from(nextUrl.searchParams.entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }
      return leftKey.localeCompare(rightKey);
    },
  );

  if (
    !changed &&
    (originalEntries.length !== normalizedEntries.length ||
      originalEntries.some(
        ([key, value], index) =>
          normalizedEntries[index]?.[0] !== key || normalizedEntries[index]?.[1] !== value,
      ))
  ) {
    changed = true;
  }

  if (changed) {
    nextUrl.search = "";
    for (const [key, value] of normalizedEntries) {
      nextUrl.searchParams.append(key, value);
    }
  }

  return {
    changed,
    url: nextUrl,
  };
};
