/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const isDev = process.env.NODE_ENV == "development";
const rewites =
  process.env.NODE_ENV == "development"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/comment",
              destination: "http://127.0.0.1:8360/comment", // Proxy to Backend
            },
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:3000/api/:path*", // Proxy to Backend
            },
          ];
        },
      }
    : {};

const getAllowDomains = () => {
  const domainsInEnv = process.env.VAN_BLOG_ALLOW_DOMAINS || "";
  if (domainsInEnv && domainsInEnv != "") {
    const arr = domainsInEnv.split(",");
    return arr;
  } else {
    if (isDev) {
      return ["pic.mereith.com",'localhost','127.0.0.1'];
    }
    return [];
  }
};
const getCdnUrl = () => {
  if (isDev) {
    return {};
  }
  const UrlInEnv = process.env.VAN_BLOG_CDN_URL || "";
  if (UrlInEnv && UrlInEnv != "") {
    return { assetPrefix: UrlInEnv };
  } else {
    return {};
  }
};
module.exports = withBundleAnalyzer({
  reactStrictMode: true,
  generateEtags: true,
  output: "standalone",
  experimental: {
    largePageDataBytes: 1024 * 1024 * 10,
  },
  async headers() {
    return [
      {
        source: "/post/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          {
            key: "Surrogate-Control",
            value: "max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/((?!api|admin|_next/static).*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          {
            key: "Surrogate-Control",
            value: "max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    domains: getAllowDomains(),
  },
  ...getCdnUrl(),
  ...rewites,
});
