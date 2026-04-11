export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isReadMethod = request.method === "GET" || request.method === "HEAD";
    const authHeaderNames = new Set([
      "authorization",
      "proxy-authorization",
      "token",
      "x-token",
      "x-api-key",
      "api-key",
    ]);

    const hasAuthLikeHeader = [...request.headers.keys()].some((rawName) => {
      const name = rawName.toLowerCase();
      if (authHeaderNames.has(name)) {
        return true;
      }
      if (name.startsWith("x-") && (name.includes("token") || name.includes("auth"))) {
        return true;
      }
      return name.endsWith("-token") || name.endsWith("_token") || name.includes("api-key");
    });

    const isPublicHtml =
      isReadMethod &&
      (url.pathname === "/" ||
        url.pathname.startsWith("/post/") ||
        url.pathname === "/archive" ||
        url.pathname.startsWith("/archive/") ||
        url.pathname.startsWith("/category") ||
        url.pathname.startsWith("/tag") ||
        url.pathname === "/timeline" ||
        url.pathname === "/moment" ||
        url.pathname === "/nav" ||
        url.pathname === "/about" ||
        url.pathname === "/link" ||
        url.pathname.startsWith("/c/") ||
        url.pathname.startsWith("/moment/") ||
        url.pathname.startsWith("/nav/"));

    if (!isPublicHtml) {
      return fetch(request);
    }

    if (hasAuthLikeHeader) {
      return fetch(request);
    }

    for (const key of [...url.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "gclid" ||
        key === "msclkid"
      ) {
        url.searchParams.delete(key);
      }
    }

    const filteredCookies = [];
    const cookieHeader = request.headers.get("Cookie") || "";
    for (const rawPart of cookieHeader.split(";")) {
      const part = rawPart.trim();
      if (!part) {
        continue;
      }
      const [name] = part.split("=");
      const normalizedName = (name || "").trim().toLowerCase();
      if (
        normalizedName === "token" ||
        normalizedName === "auth" ||
        normalizedName === "authorization" ||
        normalizedName === "session" ||
        normalizedName === "session-id" ||
        normalizedName === "session_id" ||
        normalizedName === "sessionid" ||
        normalizedName === "connect.sid" ||
        normalizedName === "next-auth.session-token" ||
        normalizedName.endsWith(".token") ||
        normalizedName.endsWith("_token") ||
        normalizedName.endsWith("-token") ||
        normalizedName.includes("session-token") ||
        normalizedName.startsWith("__secure-next-auth") ||
        normalizedName.startsWith("__host-next-auth")
      ) {
        filteredCookies.push(part);
      }
    }

    const headers = new Headers(request.headers);
    if (filteredCookies.length > 0) {
      return fetch(request);
    }
    headers.delete("Cookie");

    const normalizedRequest = new Request(url.toString(), {
      method: request.method,
      headers,
      redirect: request.redirect,
    });

    return fetch(normalizedRequest, {
      cf: {
        cacheEverything: true,
      },
    });
  },
};
