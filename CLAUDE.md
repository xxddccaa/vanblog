# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

VanBlog 是一个自托管的个人博客平台，采用 pnpm monorepo 架构。这是一个**三合一项目**，三个服务打包在同一个 Docker 容器中运行：

| 服务 | 目录 | 端口 | 技术栈 |
|------|------|------|--------|
| 后端 API | packages/server | 3000 | NestJS + MongoDB |
| 前台网站 | packages/website | 3001 | Next.js + Tailwind |
| 后台管理 | packages/admin | 3002 | Umi.js + Ant Design Pro |

其他包：
- **packages/cli** - MongoDB 工具 CLI
- **packages/waline** - Waline 评论系统（端口 8360，默认禁用）

## 开发命令

```bash
# 开发启动（构建并查看日志）
docker compose down && docker compose up -d --build && docker compose logs -f

# 仅查看日志
docker compose logs -f

# 重启容器
docker compose restart
```

## 访问地址

通过 Caddy 反向代理统一访问，端口 **18000**：
- 前台网站：`http://localhost:18000/`
- 后台管理：`http://localhost:18000/admin`
- API 文档：`http://localhost:18000/swagger`

也可直接访问各服务端口：
- 后端 API：`http://localhost:3000/`
- 前台网站：`http://localhost:3001/`
- 后台管理：`http://localhost:3002/`

## Caddy 路由规则（CaddyfileTemplateLocal）

```
/static/*、/api/*、/swagger*、/rss/*  →  127.0.0.1:3000 (后端)
/admin*                               →  静态文件 /app/admin
其他请求                               →  127.0.0.1:3001 (前台)
Waline API (/api/comment* 等)         →  127.0.0.1:8360
```

## 项目架构

### 后端 (NestJS)
- **Controllers**: `src/controller/admin/` 管理端 API，`src/controller/public/` 公开 API
- **Providers**: `src/provider/` 业务逻辑（article、draft、category、tag、user、meta、static 等）
- **Schemas**: `src/scheme/` Mongoose 数据模型
- **Guards**: `LoginGuard`、`AccessGuard`、`TokenGuard` 鉴权中间件

### 前台 (Next.js)
- 使用 ISR（增量静态再生）提升性能
- 页面在 `src/pages/`，API 调用在 `src/api/`
- ISRProvider 在内容变更时触发静态页面重新生成

### 后台 (Umi.js)
- 路由配置：`config/routes.js`
- 页面：`src/pages/`
- API 服务：`src/services/van-blog/api.js`
- 使用 Monaco Editor 编辑 Markdown

## 文件命名规范

- DTO: `src/types/*.dto.ts`
- Schema: `src/scheme/*.schema.ts`
- Provider: `src/provider/*/*.provider.ts`
- Controller: `src/controller/*/*.controller.ts`

## Docker 构建

多阶段构建，最终镜像包含：
- Node 18 + Caddy + 编译后的三个服务
- 环境变量：`VAN_BLOG_DATABASE_URL`、`VAN_BLOG_VERSIONS`

数据卷映射：
- `/root/van/data/static` - 图床文件
- `/root/van/data/mongo` - MongoDB 数据
- `/root/van/log` - 日志文件
