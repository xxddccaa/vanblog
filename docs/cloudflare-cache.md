# Cloudflare Public Cache Rules

This repo now emits origin cache headers for public HTML, public JSON fragments, and generated artifacts. Cloudflare still needs matching Cache Rules so HTML and JSON can be cached at the edge instead of always falling through to origin.

A machine-readable starter config is also available at [docs/cloudflare-cache-rules.example.json](/root/vanblog/vanblog_git/vanblog/docs/cloudflare-cache-rules.example.json).

## Status Boundaries

### Implemented in this repo

- `packages/website/next.config.js` emits `Cache-Control`, `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`, and `Cache-Tag` for public HTML groups.
- `packages/server/src/provider/public-cache/public-cache.middleware.ts` emits cache headers, strong `ETag`, `Last-Modified`, anonymous-read cacheability, and `no-store` bypass for auth/write/search/admin-nav responses.
- `packages/server/src/provider/public-cache/public-cache.middleware.ts` keeps public cacheable responses free of `Vary: Cookie` and `Vary: User-Agent`, and falls back to `no-store` if a public response tries to emit `Set-Cookie`.
- `packages/server/src/main.ts` and `packages/server/src/utils/staticCacheHeaders.ts` serve `search-index.json`, RSS feeds, and sitemap files as static artifacts with cache headers and cache tags.
- `packages/website/proxy.ts` strips tracking params from anonymous cacheable public HTML requests before page rendering, while bypassing auth-like headers and authenticated cookies.
- Public article reads are split into shell and fragments: `/api/public/article/:id`, `/api/public/article/:id/nav`, `/api/public/article/:id/engagement`, `/api/public/article/:id/fragments`, plus `/api/public/site-stats`.
- Frontend overview pages avoid engagement/comment/viewer fragment reads during SSR, and article detail pages load those fragments asynchronously.
- Browser-side pageview writes are split away from route rendering: `packages/website/pages/_app.tsx` delegates to `packages/website/utils/pageviewLifecycle.ts`, which records pageviews through `navigator.sendBeacon()` when available and falls back to `fetch(..., { keepalive: true })`.
- Article create, update, and delete flows refresh `search-index`, RSS, sitemap, and targeted Cloudflare purge payloads.
- `packages/server/src/provider/cloudflare-cache/cloudflare-cache.provider.ts` always prefers tag purge when credentials are configured, and only sends URL purge after it can resolve absolute URLs from `siteInfo.baseUrl`.
- `docker-compose.yml` and `docker-compose.image.yml` now pass `VAN_BLOG_CLOUDFLARE_API_TOKEN` and `VAN_BLOG_CLOUDFLARE_ZONE_ID` through to the `server` container so image deployments can actually use the purge integration.

### Requires Cloudflare dashboard rollout

- Create the Cache Rules below in Cloudflare so public HTML and public JSON actually become edge-cacheable.
- Configure cache-key normalization to ignore `utm_*`, `fbclid`, `gclid`, and anonymous cookies. If the current plan cannot do that natively, use the Worker fallback in this repo or redirect-based normalization.
- Enable optional Cloudflare features such as `Tiered Cache` and `Respect Strong ETags` in the dashboard if the zone plan supports them.
- Use Cloudflare Cache Analytics after rollout to validate HIT ratio and origin-request reduction.
- Make sure the site metadata `baseUrl` is set to the final public origin in `/admin/init` or later site settings, otherwise Cloudflare file purge for page and feed URLs will be skipped.

### Not implemented yet in repo

- Viewer/like writes are not backed by Redis aggregation or queue-based flushing yet; only the browser-side `sendBeacon` split is implemented.
- Cache HIT verification in a live Cloudflare zone is not covered by repo tests.
- The public archive model is year/month archives rather than a more advanced multi-bucket strategy; deeper bucket experiments remain future work.

## Recommended Rule Order

### 1. Bypass admin and write traffic

Match:

- `/admin*`
- `/api/admin/*`
- `/api/comment*`
- `/comment*`
- `/ui*`
- `/user*`
- `/token*`
- `/db*`
- `/oauth*`
- all non-`GET` and non-`HEAD` requests

Action:

- `Cache eligibility: Bypass cache`

### 2. Cache public HTML

Match:

- `/`
- `/post/*`
- `/archive*`
- `/category*`
- `/tag*`
- `/timeline`
- `/about`
- `/link`
- `/c/*`

Action:

- `Cache eligibility: Eligible for cache`
- `Cache level: Cache Everything`
- `Edge TTL: Respect origin`
- limit the rule to `GET` and `HEAD`

### 3. Bypass public search and admin nav payloads

Match:

- `/api/public/search*`
- `/api/public/nav/admin-data`

Action:

- `Cache eligibility: Bypass cache`
- limit the rule to `GET` and `HEAD`

Notes:

- these endpoints live under `/api/public/*`, but they are not edge-cacheable public fragments

### 4. Cache public JSON fragments

Match:

- `/api/public/*`

Action:

- `Cache eligibility: Eligible for cache`
- `Cache level: Cache Everything`
- `Edge TTL: Respect origin`
- limit the rule to `GET` and `HEAD`

Notes:

- keep any authenticated request bypassed

### 5. Dynamic public pages

Match:

- `/moment*`
- `/nav*`

Action:

- `Cache eligibility: Eligible for cache`
- `Cache level: Cache Everything`
- `Edge TTL: Respect origin`
- limit the rule to `GET` and `HEAD`

## Cache Key Hygiene

- Ignore marketing query params such as `utm_*`, `fbclid`, and `gclid`.
- Ignore anonymous cookies on public pages.
- The origin middleware in this repo now follows the same rule for `/api/public/*`: only auth-like cookies bypass cache, while anonymous preference cookies do not force `no-store`.
- If a Worker fallback is used, bypass cache normalization entirely when auth-like cookies such as `token`, `session`, `sessionid`, `connect.sid`, or `next-auth.session-token` are present.
- If the current Cloudflare plan cannot normalize keys directly, use a Worker or redirect-based URL normalization before cache lookup.

This repo now also includes a Next.js redirect fallback at [packages/website/proxy.ts](/root/vanblog/vanblog_git/vanblog/packages/website/proxy.ts), which strips tracking params from anonymous cacheable public HTML URLs before the request reaches the page renderer, and skips normalization entirely when auth-like headers or authenticated cookies are present.

### Worker Fallback

If the current Cloudflare plan cannot customize the cache key directly, this repo now includes a Worker example at [docs/cloudflare-worker-cache-normalize.js](/root/vanblog/vanblog_git/vanblog/docs/cloudflare-worker-cache-normalize.js).

That Worker template:

- strips `utm_*`, `fbclid`, `gclid`, and `msclkid`
- skips cache normalization entirely for auth-like request headers such as `Authorization`, `token`, `x-token`, and `x-api-key`
- bypasses cache normalization when obviously authenticated cookies such as `token`, `session`, `sessionid`, `connect.sid`, and `next-auth.session-token` are present
- removes anonymous cookies before cache lookup
- only applies to public HTML paths, not admin or write traffic

## Optional Enhancements

- Enable `Tiered Cache`.
- Enable `Respect Strong ETags`.
- Use `Cache Analytics` to watch `/`, `/post/*`, `/api/public/article/*/engagement`, and Waline-related traffic after rollout.

## Origin Contract in This Repo

- `packages/website/next.config.js` defines stable HTML TTL for `/post/*`, `/about`, `/link`, `/c/*`.
- `packages/website/next.config.js` defines shorter listing TTL for `/`, `/archive`, `/archive/:year`, `/category*`, `/tag*`, and `/timeline`, while month archive pages get the stable long-HTML TTL and legacy `/page/*` routes are redirected away from content pages.
- `packages/server/src/provider/public-cache/public-cache.middleware.ts` defines fragment TTL for `/api/public/article/:id/nav`, `/api/public/article/:id/engagement`, `/api/public/site-stats`, `/api/public/timeline/summary`, `/api/public/category/summary`.
- `packages/server/src/provider/public-cache/public-cache.middleware.ts` defines dedicated shorter TTL for `/api/public/moment*` and medium TTL for `/api/public/nav*`.
- `packages/server/src/main.ts` defines static artifact TTL for `/static/search-index.json`, `/rss/*`, and `/sitemap/*`.
- `docker/caddy/Caddyfile` and `docker/caddy/Caddyfile.https` expose the user-facing artifact aliases `/feed.xml`, `/feed.json`, `/atom.xml`, and `/sitemap.xml` by rewriting them to the generated static files on the server.
- `packages/server/src/provider/cloudflare-cache/cloudflare-cache.provider.ts` converts purge file paths to absolute URLs with `siteInfo.baseUrl`; when `baseUrl` is missing it skips file purge, logs the reason, and leaves tag purge plus TTL expiry as the fallback.

### Implemented TTL Matrix

- Stable public HTML (`/post/*`, `/about`, `/link`, `/c/*`) uses `Cache-Control: public, max-age=0, must-revalidate` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=604800, stale-while-revalidate=86400`.
- Listing HTML (`/`, `/archive`, `/archive/:year`, `/category*`, `/tag*`, `/timeline`) uses `Cache-Control: public, max-age=0, must-revalidate` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- Stable archive month HTML (`/archive/:year/:month`, `/category/:name/archive/:year/:month`, `/tag/:name/archive/:year/:month`) uses `Cache-Control: public, max-age=0, must-revalidate` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=604800, stale-while-revalidate=86400`.
- Dynamic HTML (`/moment`, `/nav`) uses `Cache-Control: public, max-age=0, must-revalidate` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- Stable public JSON (`/api/public/site-stats`, `/api/public/timeline/summary`, `/api/public/category/summary`, article shell reads, and article nav reads) uses `Cache-Control: public, max-age=60, stale-while-revalidate=86400` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- Medium-churn public nav JSON (`/api/public/nav*`, excluding `/api/public/nav/admin-data`) uses `Cache-Control: public, max-age=60, stale-while-revalidate=900` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=900, stale-while-revalidate=900`.
- High-churn public JSON (`/api/public/article/*/engagement`, `/api/public/article/*/fragments`, `/api/public/article/viewer/*`, `/api/public/comment*`) uses `Cache-Control: public, max-age=15, stale-while-revalidate=300` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=300`.
- Public viewer aggregate reads (`/api/public/viewer`) also stay on the same short-TTL contract, while the corresponding write path remains a non-cacheable browser-side beacon/fetch call.
- Public moment JSON (`/api/public/moment*`) uses `Cache-Control: public, max-age=30, stale-while-revalidate=300` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=300`.
- `/static/search-index.json` uses `Cache-Control: public, max-age=300, stale-while-revalidate=86400` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- `/rss/*` and `/sitemap/*` use `Cache-Control: public, max-age=300, stale-while-revalidate=86400` plus `Cloudflare-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400`.
- Generated artifacts keep their own static TTL contract and emit `Last-Modified`, `ETag`, and artifact-specific `Cache-Tag` values.
- Content-hashed static assets keep `Cache-Control: public, max-age=31536000, immutable`, while fixed-path assets such as `favicon.ico` stay on revalidated caching instead of one-year immutable.

## Cache-Tag Taxonomy

- Public HTML uses coarse tags emitted by `packages/website/next.config.js`: `html-public`, `html-post`, `html-listing`, `html-dynamic`, and `home`.
- Article and fragment JSON uses `packages/server/src/provider/public-cache/public-cache.middleware.ts` tags such as `article-shell`, `article-nav`, `article-engagement`, `article-fragments`, `article-ranking`, and `public-api`.
- Entity-scoped fragments and purge targets use normalized tags like `post:{id}`, `post:{pathname}`, `tag:{name}`, `category:{name}`, `timeline:{year}`, and `site-stats`.
- Summary or overview fragments use dedicated tags like `category-summary`, `timeline-summary`, `tag-hot`, `tag-list`, `category-list`, and `timeline-list`.
- Generated artifacts use `artifact:feed`, `artifact:sitemap`, and `artifact:search-index`.
- `packages/server/src/provider/isr/isr.provider.ts` computes tag and URL purge scopes after article mutations, and `packages/server/src/provider/cloudflare-cache/cloudflare-cache.provider.ts` sends the final Cloudflare tag or file purge requests.

## Current Limits

- This document describes the intended origin contract and Cloudflare rollout plan, but it does not mean the Cloudflare dashboard has already been configured in production.
- Cloudflare-only items such as Cache Rules, Tiered Cache, Respect Strong ETags, Cache Analytics, and zone-level HIT validation must be completed outside this repository.
- The current rollout keeps homepage-first freshness on `/`; year/month archives are implemented, while more specialized bucket strategies beyond that remain future work.
