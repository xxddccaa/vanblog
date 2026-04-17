/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const os = require("os");
const rootPackage = require("../../package.json");
const isDev = process.env.NODE_ENV == "development";
const markdownThemeAssetVersion =
  process.env.VANBLOG_MARKDOWN_THEME_ASSET_VERSION ||
  process.env.VAN_BLOG_VERSION ||
  rootPackage.version ||
  "dev";
const walineDevRewrites = [
  "/api/comment",
  "/api/user",
  "/api/token",
  "/api/db",
  "/api/oauth",
  "/api/ui",
].flatMap((source) => {
  const targetBase = `http://127.0.0.1:8360${source.replace("/api", "")}`;
  return [
    {
      source,
      destination: targetBase,
    },
    {
      source: `${source}/:path*`,
      destination: `${targetBase}/:path*`,
    },
  ];
});
const rewites =
  process.env.NODE_ENV == "development"
    ? {
        async rewrites() {
          return [
            ...walineDevRewrites,
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

const normalizeOriginHost = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
      return new URL(trimmed).hostname || null;
    }
  } catch (error) {
    return null;
  }

  return trimmed.split("/")[0].split(":")[0] || null;
};

const getAllowedDevOrigins = () => {
  const allowed = new Set(["127.0.0.1", "localhost"]);

  getAllowDomains().forEach((domain) => {
    const host = normalizeOriginHost(domain);
    if (host) {
      allowed.add(host);
    }
  });

  Object.values(os.networkInterfaces() || {}).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry && entry.family === "IPv4" && !entry.internal && entry.address) {
        allowed.add(entry.address);
      }
    });
  });

  return Array.from(allowed);
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
const withThemeVariantVary = (headers) => [
  ...headers,
  {
    key: "Vary",
    value: "x-vanblog-theme",
  },
];
module.exports = withBundleAnalyzer({
  reactStrictMode: true,
  generateEtags: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_MARKDOWN_THEME_ASSET_VERSION: markdownThemeAssetVersion,
  },
  allowedDevOrigins: isDev ? getAllowedDevOrigins() : undefined,
  experimental: {
    largePageDataBytes: 1024 * 1024 * 10,
  },
  async redirects() {
    return [
      {
        source: "/page/:path*",
        destination: "/archive",
        permanent: true,
      },
      {
        source: "/category/:category/page/:path*",
        destination: "/category/:category",
        permanent: true,
      },
      {
        source: "/tag/:tag/page/:path*",
        destination: "/tag/:tag",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/post/:path*",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/(about|link)",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/c/:path*",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/(moment|nav)",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-dynamic" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ]),
      },
      {
        source: "/",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing,home" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/archive/:year/:month",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post,archive-month" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/archive",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing,archive" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/archive/:path*",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing,archive" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/category/:path*",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/category/:category/archive/:year/:month",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post,archive-month" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/tag/:path*",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/tag/:tag/archive/:year/:month",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-post,archive-month" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=604800, stale-while-revalidate=86400",
          },
        ]),
      },
      {
        source: "/timeline",
        headers: withThemeVariantVary([
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Cache-Tag", value: "html-public,html-listing" },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ]),
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
      {
        source: "/markdown-themes/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source:
          "/:path(background.svg|favicon.ico|logo.svg|markdown.css|more.png|robot.txt|robots.txt|yly_tools_logo.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
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
