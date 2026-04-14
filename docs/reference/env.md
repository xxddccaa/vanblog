---
title: 环境变量
icon: leaf
order: 2
---

VanBlog 当前主要通过 compose 文件中的环境变量控制各个服务。下面列出最常见、最需要关心的几个变量。

| 名称 | 常见位置 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `EMAIL` | `caddy` | 使用内置 Caddy HTTPS 时申请证书的邮箱 | `someone@example.com` |
| `VAN_BLOG_DATABASE_URL` | `server` | PostgreSQL 连接串 | `postgresql://postgres:postgres@postgres:5432/vanblog` |
| `VAN_BLOG_WALINE_DB` | `server` / `waline` / `postgres` | 评论系统独立数据库名 | `waline` |
| `VAN_BLOG_WALINE_DATABASE_URL` | `server` | Waline 独立 PostgreSQL 连接串 | `postgresql://postgres:postgres@postgres:5432/waline` |
| `VANBLOG_WALINE_CONTROL_URL` | `server` | Waline 控制端点 | `http://waline:8361` |
| `VAN_BLOG_ALLOW_DOMAINS` | `website` | Next.js 允许加载的外部图片域名，多个用逗号分隔 | `pic.mereith.com` |
| `WALINE_JWT_TOKEN` | `server` / `website` / `waline` | Waline 与内部控制面共用的 JWT 密钥；生产镜像部署必须显式设置，源码/host-dev 调试默认 `vanblog-change-me` | 生产镜像无默认值 |
| `VANBLOG_HTTP_PORT` | `caddy` | 宿主机暴露的 HTTP 端口 | `80` |
| `VANBLOG_HTTPS_PORT` | `caddy` | 使用 `docker-compose.https.yml` 时暴露的 HTTPS 端口 | `443` |
| `VAN_BLOG_CADDY_MANAGE_HTTPS` | `server` | 是否允许后台管理内置 Caddy HTTPS 行为 | `false` |
| `VANBLOG_STATIC_DIR` | `server` | 本地图床宿主机目录 | `./data/static` |
| `VANBLOG_POSTGRES_DIR` | `postgres` | PostgreSQL 宿主机目录 | `./data/postgres` |
| `VANBLOG_REDIS_DIR` | `redis` | Redis 宿主机目录 | `./data/redis` |
| `VANBLOG_LOG_DIR` | `caddy` / `server` | 日志宿主机目录 | `./log` |

## 修改后如何生效

- 修改 compose 文件后，重新执行 `docker compose up -d`
- 如果是镜像部署，则使用 `docker compose -f docker-compose.image.yml up -d`
- 某些前台资源相关配置（例如 `VAN_BLOG_ALLOW_DOMAINS`）通常至少需要重启 `website` 服务

## 注意事项

::: warning

为避免特殊字符对 shell 造成影响，建议在 `.env` 中把包含 URL、密码、Token 的值都用引号或纯文本形式妥善保存，并避免多余空格。

:::
