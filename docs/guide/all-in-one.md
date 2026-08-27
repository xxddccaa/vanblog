---
title: 单镜像 all-in-one 部署
icon: cubes
order: 3
---

本页介绍 VanBlog **all-in-one 单镜像** 的生产部署方式——把 `caddy + server + website + admin + waline + postgres + redis` 全部收进一个容器，对外只暴露一个 HTTP 端口，配套一个 `kroki` 容器负责图表渲染。只需维护一份 compose，非常适合单机部署，也是作者线上博客实际使用的方式。

<!-- more -->

::: tip 需要多容器？
想分别维护 `caddy` / `server` / `website` / `admin` / `waline` / `postgres` / `redis`，请看 [快速上手](/guide/get-started.md) 与仓库根的 [`DEPLOY.md`](https://github.com/xxddccaa/vanblog/blob/master/DEPLOY.md)。本页只讲单镜像。
:::

## 一句话结论

**一个博客实例 = 一个独立目录**。目录名就是 compose 项目名，容器、网络、数据卷都按它自动隔离，所以同一台机器可以并存多个互不干扰的实例。密码留空即可，v1.8.0 会自动生成随机强口令。

## 部署前准备

- 一台可运行 Docker 的 Linux 服务器，已安装 `docker compose`
- 决定对外端口（放在反向代理 / Cloudflare 之后时用一个内部端口，如 `8019`）
- 如需 HTTPS 且直接对外，另见文末「HTTPS」

## 部署步骤

```bash
# 1) 为这个实例建一个独立目录
mkdir -p /srv/vanblog && cd /srv/vanblog

# 2) 取来 all-in-one compose（务必用仓库里的版本，不要用别处的旧副本）
curl -fsSL -o docker-compose.all-in-one.latest.yml \
  https://raw.githubusercontent.com/xxddccaa/vanblog/master/docker-compose.all-in-one.latest.yml

# 3) 写 .env：至少钉死对外端口；密码留空即可
cat > .env <<'ENV'
VANBLOG_HTTP_PORT=8019
ENV

# 4) 拉取并启动
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

首次启动约 40–60 秒内变为 `healthy`：

```bash
docker compose -f docker-compose.all-in-one.latest.yml ps        # 等到 healthy
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8019/  # 期望 200
```

然后浏览器打开 `http://<你的 IP 或域名>:8019/admin/` 完成 [初始化](/guide/init.md)（建管理员账号）。

## 关键配置说明

| 项 | 说明 |
| --- | --- |
| `VANBLOG_HTTP_PORT` | 对外端口。compose 默认 `80`；线上一般钉一个内部端口（如 8019）再交给反代 / Cloudflare。 |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | **留空**即可。首次启动自动生成随机强口令，持久化到 `./log/vanblog-secrets/`（及 `./secrets/`），server 自动使用同一份。 |
| `VAN_BLOG_ALLOW_DOMAINS` | 允许的图片外链域名，默认 `pic.mereith.com`，按需在 `.env` 覆盖。 |
| `EMAIL` | Caddy 自动申请证书用的邮箱（`VAN_BLOG_CADDY_MANAGE_HTTPS=true` 时才需要）。 |

::: warning 不要设弱口令
**不要**把 `POSTGRES_PASSWORD` 设成弱口令 `postgres`。v1.8.0 安全整改后入口脚本会拒绝弱口令并改用随机值；若你又用了硬编码 `VAN_BLOG_DATABASE_URL=...postgres:postgres...` 的旧 compose，server 会连库失败（`password authentication failed`）。仓库最新版 compose 已把这些默认留空，直接用即可。
:::

## 数据与备份

所有数据都挂在实例目录下，备份 / 迁移整个目录即可：

```text
/srv/vanblog/
├─ docker-compose.all-in-one.latest.yml
├─ .env
├─ data/        # postgres、redis、静态图床
├─ log/         # 运行日志 + vanblog-secrets/（自动生成的密码）
├─ secrets/     # 运行时密钥
├─ caddy/       # 证书与配置
└─ aliyunpan/   # 可选的阿里云盘配置
```

逻辑备份数据库：

```bash
cd /srv/vanblog
docker exec "$(docker compose ps -q vanblog)" sh -c 'su-exec postgres pg_dumpall' > pg_dumpall.$(date +%Y%m%d).sql
```

更完整的备份 / 迁移说明见 [备份与迁移](/guide/backup.md)。

## 多实例（同机并存多个博客）

再开一个站点，只要换目录 + 换端口，重复部署步骤即可，两个实例天然隔离：

```bash
mkdir -p /srv/vanblog-b && cd /srv/vanblog-b
curl -fsSL -o docker-compose.all-in-one.latest.yml \
  https://raw.githubusercontent.com/xxddccaa/vanblog/master/docker-compose.all-in-one.latest.yml
printf 'VANBLOG_HTTP_PORT=13080\n' > .env
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

## 升级到新版本

`vanblog-all-in-one-latest` 标签每次发版都会同步到最新正式版，升级只需在实例目录里重新拉取：

```bash
cd /srv/vanblog

# 1) 升级前备份
cp docker-compose.all-in-one.latest.yml docker-compose.all-in-one.latest.yml.bak
docker exec "$(docker compose ps -q vanblog)" sh -c 'su-exec postgres pg_dumpall' > pg_dumpall.$(date +%Y%m%d).sql

# 2) 从旧版本升级时，务必把 compose 换成仓库最新版（旧副本可能仍硬编码弱口令，见上）
curl -fsSL -o docker-compose.all-in-one.latest.yml \
  https://raw.githubusercontent.com/xxddccaa/vanblog/master/docker-compose.all-in-one.latest.yml
# 如需保持原端口，确认 .env 里的 VANBLOG_HTTP_PORT 仍是你要的值

# 3) 拉新镜像并重启
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

- `./data` 会被复用，博客内容不受影响。
- 从旧版首次升到 v1.8.0 时，PostgreSQL 密码会被轮换为随机强口令，属预期行为，可自愈。
- 回滚：把 `docker-compose.all-in-one.latest.yml.bak` 覆盖回去，或把 `image:` 指到某个具体版本标签（如 `kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z-<image-id>`），再 `up -d`。

## 锁定具体版本

生产上想精确锁版 / 便于回滚，可把 compose 里的 `image:` 从 `-latest` 改成带版本的不可变标签：

```text
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z            # 版本别名
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z-<image-id> # 不可变标签
```

## HTTPS

- **推荐**：容器只跑 HTTP（`VAN_BLOG_CADDY_MANAGE_HTTPS=false`，默认），外层用 Nginx / Caddy / Cloudflare 处理 TLS，把流量转发到 `VANBLOG_HTTP_PORT`。
- 若想让内置 Caddy 直接管证书：域名解析到本机、放行 `80/443`、把对外端口设为 `80`、`.env` 里设 `VAN_BLOG_CADDY_MANAGE_HTTPS=true` 与 `EMAIL=<你的邮箱>`。

## 常见问题

- **前台一直 502**：server 还在启动（首次带数据启动更久）。`docker logs <容器> --tail 30` 看进度；启动过程中偶发一次 `ISRProvider ... ECONNRESET` 是无害的启动竞态。
- **`password authentication failed`**：几乎都是用了硬编码弱口令的旧 compose。换成仓库最新版、`POSTGRES_PASSWORD` 留空后重启。
- **图表 / PlantUML**：v1.8.0 的 all-in-one 只保留 `vanblog` + `kroki` 两个容器（已去掉独立的 kroki-plantuml）。
