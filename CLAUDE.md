# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 仓库还提供一份更详尽的 `AGENTS.md`（面向多 AI 的协作约定）以及 `README.md` / `RELEASE.md` / `DEPLOY.md`。当 CLAUDE.md 与这些文档冲突时，以更具体的那份为准；本文件只保留对 Claude Code 实例最常用的约束。

## 仓库定位

VanBlog 的定制分支，pnpm monorepo，Node 24 / pnpm 10。基线版本在根 `package.json#version` 与 `RELEASE.md` 维护。默认部署形态是 **Docker Compose 多容器**，由 Caddy 统一路由；同时保留可选的“非 AI 单镜像 all-in-one”入口。

四个长期约定：

- 核心博客栈默认不变：`docker-compose.yml` / `docker-compose.image.yml` 只编排 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`。
- 镜像仓库固定使用 `kevinchina/deeplearning`，所有发布/回滚文档都基于它。
- “单镜像”指的是新的 `docker-compose.all-in-one*.yml` + `vanblog-all-in-one-*` 标签，不要回退到历史遗留的 `vanblog-latest` 单镜像方案。

## 服务拓扑

| 服务 | 目录 | 容器内端口 | 说明 |
|------|------|------------|------|
| `caddy` | `docker/caddy/Caddyfile` | 80 / 443 / 2019(仅内网) | 唯一对外网关 |
| `server` | `packages/server` | 3000 | NestJS API、Swagger |
| `website` | `packages/website` | 3001 / 3011 | Next.js 前台 + 控制端点 |
| `admin` | `packages/admin` | 3002 | Umi 后台静态产物，挂在 `/admin/` 子路径 |
| `waline` | `packages/waline` | 8360 / 8361 | 评论服务 + 控制端点 |
| `postgres` | — | 5432(仅内网) | 主业务数据库 |
| `redis` | — | 6379(仅内网) | 缓存/队列 |

默认入口：前台 `/`、后台 `/admin`（自动 308 到 `/admin/`）、API 文档 `/swagger`、评论 `/comment/`。

`postgres` / `redis` / Caddy admin API `2019` 不允许暴露到 `0.0.0.0`；改 compose 时这是硬约束。

## Caddy 路由要点

`docker/caddy/Caddyfile` 当前生效的核心规则：

```text
/api/*、/static/*、/swagger*、/rss/*、/sitemap/*  -> server:3000
/admin                                            -> 308 -> /admin/
/admin*                                           -> admin:3002
/api/comment*、/comment*、/ui*                    -> waline:8360
其他                                               -> website:3001
```

涉及 `/admin` 的改动必须考虑：静态资源、favicon、manifest、内部跳转都要兼容子路径。

## Compose 文件矩阵

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | 本地源码构建主栈 |
| `docker-compose.image.yml` + `.env.release.example` | 锁版部署主栈（推荐生产） |
| `docker-compose.latest.yml` | latest 镜像快速拉起主栈 |
| `docker-compose.all-in-one.yml` / `.latest.yml` / `.image.yml` | 非 AI 单镜像入口（`vanblog-all-in-one-*`） |
| `docker-compose.https.yml` | overlay：HTTPS 配置 |

## 常用命令

根目录执行（pnpm workspace）：

```bash
pnpm install
pnpm dev                    # server + admin 并行
pnpm dev:website            # Next.js 前台 (3001)
pnpm dev:server             # 仅 server，禁用内嵌 website
pnpm dev:admin              # 仅 admin (3002)
pnpm build                  # server + admin + website 生产构建
pnpm build:server | build:admin | build:website
```

测试（按门槛由小到大）：

```bash
pnpm test:deploy            # compose / Caddy / 暴露面静态校验
pnpm test:blog-flow         # 起整套容器跑端到端：初始化、登录、草稿、发布、前台浏览
pnpm test:full              # 全量回归（发版前）

pnpm --filter @vanblog/server test
pnpm --filter @vanblog/server test -- <pattern>           # 单 spec
pnpm --filter @vanblog/server test:e2e
pnpm --filter @vanblog/theme-default test -- --run        # website Vitest
pnpm --filter @vanblog/admin tsc                          # admin 类型检查
```

部署 / 发布：

```bash
docker compose up -d --build
docker compose -f docker-compose.image.yml up -d
docker compose logs -f caddy server website admin waline postgres redis

pnpm release:images            # 5 个核心镜像本地构建
pnpm release:images:push       # 5 个核心镜像构建并推送
pnpm release:publish           # 完整发版流程
pnpm release:latest            # 仅同步 5 个核心镜像的 latest 别名
pnpm release:all-in-one        # 非 AI 单镜像本地构建
pnpm release:all-in-one:push
pnpm release:all-in-one:publish
pnpm release:all-in-one:latest --version vX.Y.Z --image-id <id>
```

发布版本号取自根 `package.json`，image id 取自 `git rev-parse --short=8 HEAD`，除非显式覆盖。

## 主机调试（host-debug）

机器上有两套 `18080` 调试入口，详情见 `docs/host-debug.md`，另有专用 `docs/reference/test-env.md`。Claude 进入快速迭代时**优先用 host-debug**。

```bash
pnpm host:dev:up          # 起 host caddy + 宿主机 server/website/admin/waline；postgres/redis 仍在 docker
pnpm host:dev:down
pnpm host:dev:status
```

- 入口：`http://127.0.0.1:18080`
- 长跑进程通过 `tmux` 保持。
- 编辑 `packages/server` / `packages/website` / `packages/admin` 通常会被 dev server 自动 reload，不需要重启整套。
- 改 `tests/host-dev/Caddyfile`、`scripts/host-dev-*.sh`、端口、代理或启动 env/args 后必须 `pnpm host:dev:down && pnpm host:dev:up`。
- 当问题涉及 `/admin` 子路径、静态资源、Caddy、WebSocket/HMR 代理、健康检查等容器侧行为时，要再回到 Docker `18080` 工作流复测：`VANBLOG_HTTP_PORT=18080 docker compose down && VANBLOG_HTTP_PORT=18080 docker compose up -d --build`。
- 镜像化验收用 `tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130`，运行时数据在 `tests/manual-v1.3.0/runtime`。

## Admin 调试 token

仅用于本地 / 测试态浏览器验证：

- 不要把真实 token 硬编码进任何被跟踪的文件、脚本、fixtures、测试或最终回复。
- 通过一次性请求头或环境变量传入。
- 不同来源（`http://127.0.0.1:18080` 与任何转发出去的公网 host/IP）当作不同浏览器态分别验证。
- 排查 `/admin` 列表/编辑器/主题/缓存类问题时，要同时看后端 API 响应和浏览器侧状态（`localStorage`、主题模式、缓存编辑内容、资源版本）。
- 调试结束后清掉相关 origin 的 site storage。
- 生产路径上不允许依赖 debug-token 行为。

## 项目代码地图

### `packages/server`（NestJS）
- `src/controller/admin/`、`src/controller/public/`：管理端 / 公开 API。
- `src/provider/`：业务逻辑与外部控制同步。
- `src/scheme/`：兼容层 schema。
- `src/storage/`：PostgreSQL 存取。
- `src/**/*.spec.ts`：Jest 单测；e2e 在 `packages/server/test/`。

### `packages/website`（Next.js 主题）
- `pages/`：路由。
- `api/`：SSR/SSG 取数封装。
- `utils/loadConfig.ts`：浏览器端 / 构建期 / 容器运行期的服务地址解析（改 SSR/SSG 取数务必看这里）。
- `utils/markdownTheme.ts`：必须用这里的 versioned helper 引用 `/markdown-themes/` 下的 CSS，不能写死 URL，否则 Cloudflare 会继续吐旧主题。
- `__tests__/`：Vitest。

### `packages/admin`（Umi + Ant Design Pro）
- `config/config.js`：`/admin/` 子路径部署配置。
- `src/pages/`：管理页面，组件目录用 PascalCase 加 `index.tsx`。
- `src/services/van-blog/api.js`：后台 API 调用入口。
- `src/utils/markdownTheme.ts`：与 website 对应的 versioned helper。
- 构建产物挂到 `/admin/`，所有资源路径都要兼容子路径访问。

### 顶层测试
- `tests/deployment-config.test.mjs`：compose、Caddy、安全暴露面静态校验。
- `tests/blog-compose.e2e.test.mjs`：拆分栈端到端。
- `tests/all-in-one-compose.e2e.test.mjs`：单镜像路径端到端（涉及 all-in-one 时跑）。
- `tests/current-stack.api.test.mjs` / `tests/host-dev/`：当前主机 host-debug 验证。

不要修改生成产物：`packages/admin/src/.umi`、`packages/admin/dist`、`packages/website/.next`，除非任务明确要求重新生成。

## 编码风格

- 2 空格缩进；提交前跑 Prettier；根级配置取自 `@umijs/fabric`。
- NestJS 文件名保持描述性：`*.controller.ts` / `*.provider.ts` / `*.schema.ts`。
- React 组件目录/文件 PascalCase + `index.tsx`；工具函数 camelCase（如 `loadConfig.ts`、`getLayoutProps.ts`）。
- 提交 subject 使用简短的中文（参考 `git log`），保持一次提交一个逻辑变更。

## 与已有改动共存

仓库平时常常带未提交改动，本身不是停止工作的理由：

- 与任务无关的修改文件直接忽略，不要顺手格式化、stage 或 revert。
- 只有当任务需要编辑同一个已有改动的文件时才停下来：先读懂已有改动、保留作者意图，必要时先确认再动。

## 测试与发布纪律

- 每个行为变更都要补/改测试；后端 Jest，前台 Vitest，部署相关进 `tests/`。
- 改 compose / 路由 / 服务间通信地址 / SSR-SSG 取数 / `/admin` 子路径 → 至少 `pnpm test:blog-flow`，路由/配置类再加 `pnpm test:deploy`，发版前 `pnpm test:full`。
- `docker-compose.all-in-one.latest.yml` 依赖的 `kevinchina/deeplearning:vanblog-all-in-one-latest` 由 all-in-one 流程发布；遇到 `manifest unknown` 不要试图用 `pnpm release:latest` 修，那个只覆盖 5 个核心镜像。
- Docker Hub 发布在本机手工 / 脚本完成，不走 GitHub Actions。

## 排错时常见的“看似怪事”

- `kevinchina/deeplearning` 是长期保留 / 备份仓库；改其他仓库前先确认不是手误。
- 公开拓扑只能从 Caddy 80/443 进；如果别的端口看起来通了，先怀疑是 host-debug / 测试 compose 留下的状态。
- `/markdown-themes/` 下的 CSS 全靠 versioned helper 解决 Cloudflare 缓存，写死 URL 会让用户在发布后继续看到旧主题。
