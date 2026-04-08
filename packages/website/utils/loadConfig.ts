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

// 从环境变量中读取.
export const config = {
  baseUrl:
    typeof window === "undefined" ? getServerBaseUrl() : getBrowserBaseUrl(),
};

// 改为服务端触发 isr
// export const revalidate = {};
export const revalidate =
  process.env.VAN_BLOG_REVALIDATE == "true"
    ? { revalidate: parseInt(process.env.VAN_BLOG_REVALIDATE_TIME || "10") }
    : {};
