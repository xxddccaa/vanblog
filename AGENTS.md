# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo for a customized VanBlog deployment with split Docker services and Dockerized stateful dependencies.

- `packages/server`: NestJS backend; core code is in `src/`, with unit tests in `src/**/*.spec.ts` and e2e tests in `test/`.
- `packages/admin`: Umi + Ant Design Pro admin app; pages live in `src/pages`, shared UI in `src/components`.
- `packages/website`: Next.js frontend theme; routes live in `pages/`, shared UI in `components/`, helpers in `utils/`, and tests in `__tests__/`.
- `packages/waline`: Waline-related wrapper/runtime code used by the comment integration and release artifacts.
- `packages/cli`: small CLI utilities.
- `docker/`: per-service Dockerfiles, Caddy config, and runtime helper scripts for the split deployment.
- `docker-compose.yml`: local source-build runtime entrypoint; the current top-level stack wires `caddy`, `server`, `website`, `admin`, `postgres`, and `redis`.
- `docker-compose.image.yml`: deployment entrypoint that pulls already-published images for the same top-level runtime topology.
- `RELEASE.md`: canonical human + AI release guide for image naming, manual releases, and rollback.
- `DEPLOY.md`: production deployment guide for pulling published images with `.env.release.example`.
- `.env.release.example`: server-side environment template for image deployments.
- `tests/`: deployment and blog-flow integration tests for the compose stack.
- `docs/`: Markdown documentation.
- `mind-map/`: auxiliary mind-map tooling; treat it as a separate subproject unless your change targets it directly.

## Build, Test, and Development Commands
Use `pnpm` at the repo root.

- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run server and admin together for local development.
- `pnpm dev:website`: run the Next.js frontend on port `3001`.
- `pnpm build`: build the server, admin, and default website theme.
- `pnpm build:website`: build the Next.js standalone output used by the website container.
- `pnpm build:admin`: build the admin static assets served under `/admin/`.
- `pnpm --filter @vanblog/server test`: run backend unit tests.
- `pnpm --filter @vanblog/theme-default test -- --run`: run website Vitest tests.
- `pnpm test:full`: run the full regression suite, including backend tests, website tests, admin type-check, production builds, deployment assertions, and the compose blog-flow e2e.
- `pnpm test:deploy`: validate deployment config and routing assertions.
- `pnpm test:blog-flow`: build the split stack and run the full compose smoke flow.
- `pnpm release:images`: build all split release images with versioned tags locally.
- `pnpm release:images:push`: build and push all split release images.
- `docker compose up -d --build`: start the split runtime locally.
- `docker compose -f docker-compose.image.yml up -d`: start from already-published images.
- `docker compose logs -f caddy server website admin postgres redis`: inspect logs for the current top-level compose stack.

## Coding Style & Naming Conventions
Follow existing 2-space indentation and run Prettier before committing; root formatting comes from `@umijs/fabric`.

- Keep NestJS files descriptive: `*.controller.ts`, `*.provider.ts`, `*.schema.ts`.
- Use PascalCase for React component directories/files, usually with `index.tsx` entrypoints.
- Use camelCase for utilities such as `loadConfig.ts` or `getLayoutProps.ts`.
- Do not edit generated outputs like `packages/admin/src/.umi`, `packages/admin/dist`, or `packages/website/.next` unless the task explicitly requires regenerated artifacts.

## Testing Guidelines
Add or update tests for each behavior change; there is no visible repo-wide coverage gate.

- Backend tests use Jest; keep e2e coverage in `packages/server/test`.
- Frontend utility tests use Vitest with `*.spec.ts` naming.
- Deployment regressions belong in `tests/deployment-config.test.mjs` and `tests/blog-compose.e2e.test.mjs`.
- For split deployment changes, cover `/admin` routing, static assets, public reading flows, and container exposure/security assumptions.

## Release & Deployment Notes
Treat release and deployment work as documented workflows, not guesswork.

- For image publishing or versioned rollout tasks, read `RELEASE.md` first; it is the canonical guide for image naming, release commands, and rollback expectations.
- For production deployment tasks, read `DEPLOY.md` and use `docker-compose.image.yml` plus `.env.release.example`; do not switch back to the legacy single-image flow.
- Use `pnpm release:images` for local release builds and `pnpm release:images:push` for publishing; the release flow derives the version from the root `package.json` and the image id from `git rev-parse --short=8 HEAD` unless explicitly overridden.
- If release artifacts and compose topology appear different, treat `RELEASE.md` plus `scripts/release-images.sh` as the source of truth for publishable images, and treat the root `docker-compose*.yml` files as the source of truth for the currently wired runtime stack.
- For release or deployment changes, prefer validating with `pnpm test:full`; if you only need a narrower config/routing check, at minimum run `pnpm test:blog-flow`, and also run `pnpm test:deploy` for config- or routing-focused changes.
- Keep production exposure assumptions intact: public entry is through Caddy on `80/443`, `postgres` and `redis` should not gain host ports, and the Caddy admin API `2019` must stay private.

## Local Proxy & Buildx Notes
This repo may be released from a machine that uses a local proxy for GitHub and Docker Hub access.

- Default local proxy: `http://127.0.0.1:10829`
- When release, push, or remote-auth tasks need outbound access, prefer exporting:
  - `http_proxy=http://127.0.0.1:10829`
  - `https_proxy=http://127.0.0.1:10829`
- For image release tasks that need proxied outbound access, prefer reusing the existing buildx builder:
  - `vanblog-release-proxy-10829`
- Do not delete `vanblog-release-proxy-10829` unless the user explicitly asks for cleanup or confirms it is no longer needed.
- Before creating a new proxied builder, check `docker buildx ls` first and reuse an existing one when possible.
- The `moby/buildkit` / `buildx_buildkit_*` containers are build infrastructure only; they are not part of the running blog stack and do not serve web traffic.

## Host Debug Workflow
This machine now has two sanctioned `18080` debug workflows documented in `docs/host-debug.md`.

- Docker image-style acceptance on `18080`:
  - `docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 up -d`
  - `docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 down`
  - runtime data lives in `tests/manual-v1.3.0/runtime`
- Optional source-build Docker debug on `18080`:
  - `VANBLOG_HTTP_PORT=18080 docker compose up -d --build`
  - `VANBLOG_HTTP_PORT=18080 docker compose down`
- Fast host-debug on `18080`:
  - `pnpm host:dev:up`
  - `pnpm host:dev:down`
  - `pnpm host:dev:status`

- Host-debug Docker deps live in `tests/host-dev/docker-compose.yaml`
- Host-debug logs live in `tests/host-dev/runtime/log`
- Host-debug reuses runtime data from `tests/manual-v1.3.0/runtime/data`
- Host-debug long-running host processes are kept alive via `tmux` sessions
- Host-debug exposes a host Caddy proxy on `http://127.0.0.1:18080`
- This workflow intentionally runs `server` / `website` / `admin` / `waline` on the host while keeping `postgres` / `redis` in Docker, so hot reload stays fast but storage and service topology remain close to the real stack.
- When the user wants fast local iteration on this machine, prefer host-debug first.
- In host-debug mode, most edits under `packages/server`, `packages/website`, and `packages/admin` take effect automatically via dev-server reload/recompile; do not restart the whole stack unless needed.
- If `tests/host-dev/Caddyfile`, `scripts/host-dev-up.sh`, `scripts/host-dev-down.sh`, `scripts/host-dev-env.sh`, ports, proxy rules, or startup env/args changed, restart with `pnpm host:dev:down && pnpm host:dev:up`.
- When the issue involves `/admin` subpath routing, static assets, Caddy, WebSocket/HMR proxying, health checks, or other container-only behavior, validate again with the Docker `18080` workflow before concluding.

## Commit & Pull Request Guidelines
Recent history uses short, change-focused Chinese subjects, for example: `分类与标签页增加分页并优化公开文章查询。` Match that concise style or use an equally clear English summary.

- Keep one logical change per commit.
- In PRs, describe the user-facing impact, affected packages, deployment implications, and any migration or compose changes.
- Link related issues when available.
- Include screenshots or short recordings for `packages/admin` and `packages/website` UI changes.
