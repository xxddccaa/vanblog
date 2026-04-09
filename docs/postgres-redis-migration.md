# PostgreSQL / Redis Migration Plan

## Recommendation

For this blog system, the best long-term data stack is:

- PostgreSQL: yes, as the primary database for articles, categories, tags, menus, settings, navigation data, moments, links, and media metadata.
- Redis: yes, but only as an auxiliary component for short-lived counters, async invalidation jobs, rate limiting, and distributed locks.
- Elasticsearch: not for the first migration wave.

The current cache-first refactor already removes most public-page pressure from the origin. Because of that, Elasticsearch is not the next bottleneck for a typical personal blog or content site. A static search index plus PostgreSQL is enough for the next stage. Search can be upgraded later to Elasticsearch or OpenSearch only when the article count, fuzzy search requirements, or multilingual ranking needs justify the extra operational cost.

## Why this order

1. PostgreSQL solves the long-term consistency and relational modeling problem.
2. Redis helps operationally once public traffic and async jobs grow.
3. Elasticsearch only becomes worthwhile after PostgreSQL + static search are no longer enough.

## Migration strategy for existing Mongo users

This migration must be staged. Existing users already have production content in MongoDB, so the cutover must support validation and rollback.

### Phase 1: introduce storage abstraction

- Add a repository layer in the server so controllers/providers no longer depend directly on Mongoose models.
- Keep MongoDB as the source of truth during this phase.
- Define PostgreSQL schemas for:
  - articles
  - categories
  - tags
  - article_tags
  - site_meta / site_settings
  - menus
  - links
  - rewards
  - socials
  - custom_pages
  - moments
  - icons
  - nav_categories
  - nav_tools
  - visits / viewer aggregates
  - static_assets metadata
- Add a stable ID strategy that preserves current public article IDs and pathname behavior.

### Phase 2: build export and import tooling

- Add a Mongo export command that produces deterministic JSON snapshots.
- Add a PostgreSQL import command that:
  - preserves public IDs
  - preserves createdAt / updatedAt
  - preserves tag/category relationships
  - preserves hidden/private/deleted flags
  - preserves viewer/visited counters
  - preserves custom pathnames
- Make the import idempotent so it can be rerun safely.
- Add a verification command that compares record counts and key hashes across Mongo and PostgreSQL.

Current repository status:

- the admin "导出全部数据" flow now exports both logical blog entities and a `mongoCollections` raw snapshot of every MongoDB collection
- the admin import flow can restore from the logical payload and can also hydrate from the raw `mongoCollections` snapshot when needed
- images are still treated as file-path metadata only; binary files must be migrated separately

### Phase 3: dual-read verification in non-production

- Stand up PostgreSQL beside MongoDB.
- Import a full snapshot into PostgreSQL.
- In staging, enable read verification for critical entities:
  - article detail
  - article list pagination
  - tag pages
  - category pages
  - settings and menus
- Log mismatches instead of failing requests.

### Phase 4: optional dual-write window

- Add a feature flag for dual write on admin mutations.
- During this phase, writes still succeed against Mongo first.
- PostgreSQL is updated in the same request or via a durable retry queue.
- Track any write drift and stop the rollout if drift is detected.

### Phase 5: read cutover

- Flip read traffic to PostgreSQL behind a feature flag.
- Keep MongoDB available for rollback.
- Continue generating RSS, sitemap, search-index, and ISR invalidations from the PostgreSQL-backed code path.

### Phase 6: rollback window and Mongo decommission

- Keep MongoDB snapshots and the last export for a defined rollback window.
- If no correctness issues are found, stop dual write and retire MongoDB.

## Redis scope

Redis should not become the source of truth for blog content. It should be introduced only for:

- rate limiting on admin or comment-related endpoints
- short-lived counters and batching for pageview/article-view updates
- invalidation queues for revalidate, RSS, sitemap, and search-index generation
- distributed locks for scheduled tasks

Recommended policy:

- content data stays in PostgreSQL
- counters can be buffered in Redis and flushed periodically
- Cloudflare edge cache remains the first line of defense for public traffic

## Elasticsearch / OpenSearch decision gate

Do not introduce Elasticsearch in the first migration unless one of these becomes true:

- article count is large enough that static search index size becomes a real problem
- search needs typo tolerance, weighted ranking, prefix search, or multilingual analyzers
- admin search becomes operationally slow in PostgreSQL

Until then, keep using:

- static `search-index.json` for public search
- PostgreSQL queries for admin search

## Zero-downtime release checklist

- create PostgreSQL schema migrations
- run full Mongo export
- run PostgreSQL import
- run count/hash verification
- warm the public cache by regenerating hot pages, RSS, sitemap, and search index
- enable read verification in staging
- enable dual write in production
- cut read traffic to PostgreSQL
- monitor mismatches, import lag, and cache hit ratio
- keep rollback switch to Mongo during the observation window

## Rollback plan

If PostgreSQL cutover fails:

- switch reads back to Mongo immediately
- keep public cache serving stable HTML while the origin is reverted
- replay writes from the dual-write log or queue into Mongo if needed
- investigate schema drift before the next cutover attempt
