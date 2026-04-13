# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

VanBlog 是一个自托管的个人博客平台，采用 pnpm monorepo 架构。当前仓库已经切换为 **Docker Compose 多容器部署**，由 Caddy 统一对外路由：

| 服务 | 目录 | 容器内端口 | 说明 |
|------|------|------------|------|
| `server` | `packages/server` | 3000 | NestJS API、静态资源、Swagger |
| `website` | `packages/website` | 3001 / 3011 | Next.js 前台 + 控制端点 |
| `admin` | `packages/admin` | 3002 | Umi 后台静态页面，挂载到 `/admin/` |
| `waline` | `packages/waline` | 8360 / 8361 | 评论服务 + 控制端点 |
| `caddy` | `docker/caddy/Caddyfile` | 80 / 443 / 2019(仅内网) | 外部网关与路由 |
| `postgres` | - | 5432(仅内网) | 主业务数据库，不对外暴露 |
| `redis` | - | 6379(仅内网) | 缓存与队列数据库，不对外暴露 |

## 常用命令

```bash
# 启动整套多容器环境
docker compose up -d --build

# 查看主要服务日志
docker compose logs -f caddy server website admin waline postgres redis

# 停止并清理容器
docker compose down -v

# 运行部署与博客流程测试
pnpm test:blog-flow

# 构建多镜像发布标签
pnpm release:images

# 构建并推送多镜像
pnpm release:images:push
```

发布规范、镜像命名和手工发版步骤统一以 `RELEASE.md` 为准。
生产环境变量模板和服务器部署步骤统一以 `DEPLOY.md` 与 `.env.release.example` 为准。

## 访问地址

默认通过 Caddy 暴露：

- 前台网站：`http://localhost/`
- 后台管理：`http://localhost/admin`
- API 文档：`http://localhost/swagger`
- 评论前台：`http://localhost/comment/`

注意：`admin`、`website`、`server`、`waline`、`postgres`、`redis` 默认都不直接映射到宿主机；`postgres`、`redis` 和 Caddy admin API `2019` 仅允许在 compose 内部网络访问。

## Caddy 路由要点

当前 `docker/caddy/Caddyfile` 的核心路由关系：

```text
/api/*、/static/*、/swagger*、/rss/*、/sitemap/* -> server:3000
/admin      -> 308 到 /admin/
/admin*     -> admin:3002
/api/comment*、/comment*、/ui* 等 -> waline:8360
其他请求    -> website:3001
```

## 项目架构

### 后端 (`packages/server`)
- `src/controller/admin/`: 管理端 API
- `src/controller/public/`: 公开 API
- `src/provider/`: 业务逻辑与外部控制同步
- `src/scheme/`: 兼容层 schema 定义
- `src/storage/`: PostgreSQL 存储与结构化数据读写
- `src/**/*.spec.ts`: 后端单元测试

### 前台 (`packages/website`)
- `pages/`: Next.js 路由
- `api/`: SSR/SSG 获取数据的请求封装
- `utils/loadConfig.ts`: 区分浏览器端、构建期、容器运行期的服务地址
- `__tests__/`: Vitest 单测

### 后台 (`packages/admin`)
- `config/config.js`: `/admin/` 子路径部署配置
- `src/pages/`: 管理页面
- `src/services/van-blog/api.js`: 后台 API 调用
- 构建产物部署到 `/admin/`，资源路径必须兼容子路径访问

## 自动化测试重点

- `tests/deployment-config.test.mjs`: Compose、Caddy、安全暴露面检查
- `tests/blog-compose.e2e.test.mjs`: 起整套容器，验证初始化、登录、草稿、发布、前台浏览等核心流程
- `packages/server/src/controller/public/public.controller.spec.ts`: 公共接口健壮性
- `packages/website/__tests__/loadConfig.spec.ts`: 前后台地址解析逻辑

## 修改时注意

- 不要把 `postgres`、`redis` 或 Caddy admin `2019` 暴露到 `0.0.0.0`。
- 涉及 `/admin` 的改动要注意静态资源、favicon、manifest、跳转都必须兼容子路径。
- 涉及 SSR/SSG 的调用要区分构建期 fallback、容器内服务发现、浏览器端相对路径。
- 拆分部署相关改动后，优先补 deployment / compose 流程测试，而不是只依赖手工验证。
