---
title: 目录映射
icon: folder-tree
order: 3
---

VanBlog 当前采用多容器部署。为了在升级、重建容器后保留数据，请确保 compose 中的持久化目录被正确映射到宿主机。

## 默认映射关系

| 宿主机默认目录 | 容器内目录 | 说明 |
| --- | --- | --- |
| `./data/static` | `/app/static` | 本地图床与静态资源 |
| `./data/postgres` | `/var/lib/postgresql/data` | PostgreSQL 数据目录（包含 VanBlog 与 Waline 独立数据库） |
| `./data/redis` | `/data` | Redis 数据目录 |
| `./data/ai-terminal/home` | `/app/ai-terminal-home` | AI 终端 HOME、OpenCode 本地配置、缓存与 shell 历史（仅 AI overlay 启用时使用） |
| `./log` | `/var/log` | 访问日志、事件日志、恢复密钥等 |
| `./caddy/config` | `/root/.config/caddy` | Caddy 配置目录 |
| `./caddy/data` | `/root/.local/share/caddy` | Caddy 证书与运行数据 |
| `./aliyunpan/config` | `/root/.config/aliyunpan` | 可选的阿里云盘配置目录 |

## bundled FastGPT 追加映射

只有在你显式启用了 `docker-compose.fastgpt.yml` 或 `docker-compose.latest.ai.yml` 时，才需要额外关注下面这些目录：

| 宿主机默认目录              | 容器内目录                 | 说明                       |
| --------------------------- | -------------------------- | -------------------------- |
| `./data/fastgpt/vector`     | `/var/lib/postgresql/data` | FastGPT pgvector 数据      |
| `./data/fastgpt/mongo`      | `/data/db`                 | FastGPT Mongo 数据         |
| `./data/fastgpt/redis`      | `/data`                    | FastGPT Redis 数据         |
| `./data/fastgpt/minio`      | `/data`                    | FastGPT 文件对象存储       |
| `./data/fastgpt/aiproxy-pg` | `/var/lib/postgresql/data` | AIProxy 的 PostgreSQL 数据 |

## 建议

- 升级前优先确认这些目录都在宿主机上可见
- 生产环境建议把这些目录纳入常规备份
- 如果你改过 compose 里的路径，请以你自己的映射为准
- 不需要 AI 的用户，可以完全忽略 `./data/fastgpt/*` 这组目录
- 如果启用了 AI 终端，也请把 `./data/ai-terminal/home` 纳入常规备份
