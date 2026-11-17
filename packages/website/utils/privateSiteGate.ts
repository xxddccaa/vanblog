import { getServerBaseUrl } from "./loadConfig";

/** Cookie the admin writes on login so site pages can see the session. */
export const PRIVATE_SITE_ACCESS_COOKIE = "vanblog_token";

const FLAG_TTL_MS = 5_000;
const ALLOWED_TTL_MS = 30_000;
const DENIED_TTL_MS = 5_000;
const MAX_CACHE_ENTRIES = 1_000;

export interface PrivateSiteAccess {
  privateSite: boolean;
  allowed: boolean;
}

let knownPrivateSite: { value: boolean; expiresAt: number } | null = null;
const accessCache = new Map<string, { allowed: boolean; expiresAt: number }>();

/** Paths rendered as site pages; assets, API routes and Next internals are skipped. */
export const isPrivateSitePagePath = (pathname: string) => {
  if (!pathname || pathname.startsWith("/_next/") || pathname.startsWith("/api/")) {
    return false;
  }
  if (pathname.startsWith("/admin")) {
    return false;
  }
  // Public files (images, fonts, robots.txt...) do not contain post content.
  return !/\.[a-z0-9]+$/i.test(pathname);
};

export const readAccessCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) {
    return "";
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0 || part.slice(0, separator).trim() !== PRIVATE_SITE_ACCESS_COOKIE) {
      continue;
    }
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
};

/** Only same-site relative paths are passed to the login page as return targets. */
export const buildPrivateSiteLoginPath = (pathname: string, search = "") => {
  const target = `${pathname}${search}`;
  const safeTarget = target.startsWith("/") && !target.startsWith("//") ? target : "/";
  return `/admin/user/login?return=${encodeURIComponent(safeTarget)}`;
};

const fetchAccess = async (token: string): Promise<PrivateSiteAccess | null> => {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.token = token;
    }
    const response = await fetch(`${getServerBaseUrl()}api/public/private-site/access`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    return {
      privateSite: Boolean(body?.data?.privateSite),
      allowed: Boolean(body?.data?.allowed),
    };
  } catch {
    return null;
  }
};

/**
 * Decides whether a page request may be rendered. The answer is cached briefly
 * so the API server is not asked on every request.
 */
export const checkPrivateSiteAccess = async (token: string): Promise<PrivateSiteAccess> => {
  const now = Date.now();
  if (knownPrivateSite && knownPrivateSite.expiresAt > now && !knownPrivateSite.value) {
    return { privateSite: false, allowed: true };
  }

  const cacheKey = token || "-";
  const cached = accessCache.get(cacheKey);
  if (knownPrivateSite?.value && cached && cached.expiresAt > now) {
    return { privateSite: true, allowed: cached.allowed };
  }

  const access = await fetchAccess(token);
  if (!access) {
    // Without an answer keep the last known mode; a private site stays closed.
    const privateSite = knownPrivateSite?.value ?? false;
    return { privateSite, allowed: !privateSite };
  }

  knownPrivateSite = { value: access.privateSite, expiresAt: now + FLAG_TTL_MS };
  if (access.privateSite) {
    if (accessCache.size >= MAX_CACHE_ENTRIES) {
      accessCache.clear();
    }
    accessCache.set(cacheKey, {
      allowed: access.allowed,
      expiresAt: now + (access.allowed ? ALLOWED_TTL_MS : DENIED_TTL_MS),
    });
  }
  return access;
};

/** Test hook. */
export const resetPrivateSiteGateCache = () => {
  knownPrivateSite = null;
  accessCache.clear();
};
