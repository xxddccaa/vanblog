# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo for a customized VanBlog deployment with split Docker services.

- `packages/server`: NestJS backend; core code is in `src/`, with unit tests in `src/**/*.spec.ts` and e2e tests in `test/`.
- `packages/admin`: Umi + Ant Design Pro admin app; pages live in `src/pages`, shared UI in `src/components`.
- `packages/website`: Next.js frontend theme; routes live in `pages/`, shared UI in `components/`, helpers in `utils/`, and tests in `__tests__/`.
- `packages/waline`: embedded Waline comment service wrapper.
- `packages/cli`: small CLI utilities.
- `docker/`: per-service Dockerfiles, Caddy config, and runtime helper scripts for the split deployment.
- `docker-compose.yml`: local and production-like multi-container orchestration entrypoint.
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
- `pnpm test:deploy`: validate deployment config and routing assertions.
- `pnpm test:blog-flow`: build the split stack and run the full compose smoke flow.
- `docker compose up -d --build`: start the split runtime locally.
- `docker compose logs -f caddy server website admin waline mongo`: inspect container logs by service.

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

## Commit & Pull Request Guidelines
Recent history uses short, change-focused Chinese subjects, for example: `分类与标签页增加分页并优化公开文章查询。` Match that concise style or use an equally clear English summary.

- Keep one logical change per commit.
- In PRs, describe the user-facing impact, affected packages, deployment implications, and any migration or compose changes.
- Link related issues when available.
- Include screenshots or short recordings for `packages/admin` and `packages/website` UI changes.
