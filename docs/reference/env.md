---
title: 环境变量
icon: leaf
order: 2
---

VanBlog 当前主要通过 compose 文件中的环境变量控制各个服务。下面列出最常见、最需要关心的几个变量。

| 名称 | 常见位置 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `EMAIL` | `caddy` | 使用内置 Caddy HTTPS 时申请证书的邮箱 | `someone@example.com` |
| `VANBLOG_DOCKER_REPO` | `.env` / `docker-compose.image.yml` | 锁版镜像部署使用的镜像仓库 | `kevinchina/deeplearning` |
| `VANBLOG_RELEASE_SUFFIX` | `.env` / `docker-compose.image.yml` | 锁版镜像部署使用的标签后缀，如 `v1.4.1-<image-id>` | 无 |
| `VAN_BLOG_DATABASE_URL` | `server` | PostgreSQL 连接串 | `postgresql://postgres:postgres@postgres:5432/vanblog` |
| `VAN_BLOG_WALINE_DB` | `server` / `waline` / `postgres` | 评论系统独立数据库名 | `waline` |
| `VAN_BLOG_WALINE_DATABASE_URL` | `server` | Waline 独立 PostgreSQL 连接串 | `postgresql://postgres:postgres@postgres:5432/waline` |
| `VANBLOG_WALINE_CONTROL_URL` | `server` | Waline 控制端点 | `http://waline:8361` |
| `VAN_BLOG_ALLOW_DOMAINS` | `website` | Next.js 允许加载的外部图片域名，多个用逗号分隔 | `pic.mereith.com` |
| `WALINE_JWT_TOKEN` | `server` / `website` / `waline` | Waline 与内部控制面共用的 JWT 密钥；留空时镜像运行时会自动生成并落盘到日志目录中的 `waline.jwt`，也可手动指定覆盖 | 可留空自动生成 |
| `VANBLOG_HTTP_PORT` | `caddy` | 宿主机暴露的 HTTP 端口 | `80` |
| `VANBLOG_HTTPS_PORT` | `caddy` | 使用 `docker-compose.https.yml` 时暴露的 HTTPS 端口 | `443` |
| `VAN_BLOG_CADDY_MANAGE_HTTPS` | `server` | 是否允许后台管理内置 Caddy HTTPS 行为 | `false` |
| `VAN_BLOG_CLOUDFLARE_API_TOKEN` | `server` | Cloudflare API Token；配合 `VAN_BLOG_CLOUDFLARE_ZONE_ID` 启用精准 purge | 空 |
| `VAN_BLOG_CLOUDFLARE_ZONE_ID` | `server` | Cloudflare Zone ID；配合 `VAN_BLOG_CLOUDFLARE_API_TOKEN` 启用精准 purge | 空 |
| `VAN_BLOG_FASTGPT_INTERNAL_URL` | `server` + AI override | FastGPT 私有地址；只能指向私网、容器网络或 localhost | `http://fastgpt-app:3000` |
| `FASTGPT_ROOT_PASSWORD` | `server` + AI override | 让 VanBlog admin 自动登录 FastGPT root 并同步 bundled 模型 / 自动建资源 | 空 |
| `FASTGPT_FREE_PLAN_POINTS` | `fastgpt-bootstrap` | bundled FastGPT 修复旧数据卷 free plan 时的 points | `100` |
| `FASTGPT_FREE_PLAN_DURATION_DAYS` | `fastgpt-bootstrap` | bundled FastGPT 修复旧数据卷 free plan 时的时长 | `30` |
| `VANBLOG_STATIC_DIR` | `server` | 本地图床宿主机目录 | `./data/static` |
| `VANBLOG_POSTGRES_DIR` | `postgres` | PostgreSQL 宿主机目录 | `./data/postgres` |
| `VANBLOG_REDIS_DIR` | `redis` | Redis 宿主机目录 | `./data/redis` |
| `VANBLOG_LOG_DIR` | `caddy` / `server` | 日志宿主机目录 | `./log` |

## 修改后如何生效

- 修改 compose 文件后，重新执行 `docker compose up -d`
- 如果是 latest 镜像部署，则使用 `docker compose -f docker-compose.latest.yml up -d`
- 如果是 latest 一文件 + AI，则使用 `docker compose -f docker-compose.latest.ai.yml up -d`
- 如果是锁版镜像部署，则使用 `docker compose -f docker-compose.image.yml up -d`
- 某些前台资源相关配置（例如 `VAN_BLOG_ALLOW_DOMAINS`）通常至少需要重启 `website` 服务

## AI 相关特别说明

- 不配置 `VAN_BLOG_FASTGPT_INTERNAL_URL` 时，默认部署不会启用 AI 工作台对 FastGPT 的连接
- 不配置 `FASTGPT_ROOT_PASSWORD` 时，`/admin/ai` 页面里的“测试模型”仍可用，但“同步模型到 FastGPT”“自动创建 Dataset / App / API Key”不可用
- `FASTGPT_FREE_PLAN_POINTS` 与 `FASTGPT_FREE_PLAN_DURATION_DAYS` 只在你使用 `docker-compose.fastgpt.yml` 时生效

## 注意事项

::: warning

为避免特殊字符对 shell 造成影响，建议在 `.env` 中把包含 URL、密码、Token 的值都用引号或纯文本形式妥善保存，并避免多余空格。

:::
