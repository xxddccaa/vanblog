import { resolveSharedSecret } from "./sharedSecret";

const normalizeURL = (url: string) => {
  if (url === "/") {
    return "/";
  }
  if (/^https?:\/\//.test(url)) {
    return new URL(url).toString();
  }
  return url.endsWith("/") ? url : `${url}/`;
};

export const getServerBaseUrl = () => {
  const defaultServerUrl =
    process.env.isBuild === "t"
      ? "http://localhost:3000"
      : process.env.NODE_ENV === "production"
        ? "http://server:3000"
        : "http://localhost:3000";

  return normalizeURL(
    process.env.VAN_BLOG_SERVER_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      defaultServerUrl
  );
};

const getBrowserBaseUrl = () =>
  normalizeURL(process.env.NEXT_PUBLIC_BASE_URL || "/");

type NextFetchOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

const getRevalidateSeconds = () => {
  if (process.env.VAN_BLOG_REVALIDATE !== "true") {
    return false;
  }
  const parsed = Number.parseInt(process.env.VAN_BLOG_REVALIDATE_TIME || "60", 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 60 : parsed;
};

// 从环境变量中读取.
export const config = {
  baseUrl:
    typeof window === "undefined" ? getServerBaseUrl() : getBrowserBaseUrl(),
};

/** Header that marks the website's own server-side requests to the API server. */
export const INTERNAL_REQUEST_HEADER = "x-vanblog-internal-token";

/** Shared secret with the API server (same source as the ISR token). */
export const getInternalRequestSecret = resolveSharedSecret;

// Lets server-side rendering read content while the private site switch is on.
const withInternalAuth = (init: NextFetchOptions): NextFetchOptions => {
  const secret = getInternalRequestSecret();
  if (!secret) {
    return init;
  }
  const headers = new Headers(init.headers);
  headers.set(INTERNAL_REQUEST_HEADER, secret);
  return { ...init, headers };
};

export const getServerFetchOptions = (
  init: NextFetchOptions = {}
): NextFetchOptions => {
  if (typeof window !== "undefined") {
    return init;
  }

  if (init.cache || init.next?.revalidate !== undefined) {
    return withInternalAuth(init);
  }

  const revalidate = getRevalidateSeconds();
  if (revalidate === false) {
    return withInternalAuth({
      ...init,
      cache: "force-cache",
    });
  }

  return withInternalAuth({
    ...init,
    next: {
      ...init.next,
      revalidate,
    },
  });
};

// 改为服务端触发 isr
// export const revalidate = {};
const configuredRevalidate = getRevalidateSeconds();

export const revalidate =
  configuredRevalidate === false
    ? {}
    : { revalidate: configuredRevalidate };
