# 生产部署指南

这份文档面向需要把已经发布好的 VanBlog 多镜像部署到服务器的人类维护者和 AI 代理。

如果你要做的是“构建并发布镜像”，请看 `RELEASE.md`；如果你要做的是“把已经发布好的镜像部署到服务器”，请看这份文档。

## 1. 部署目标

生产环境推荐使用：

- `docker-compose.image.yml`
- `.env.release.example` 复制出的 `.env`

如果你不想维护 `.env` 和 `VANBLOG_RELEASE_SUFFIX`，只是想要一个“当前目录挂载 + 直接拉 latest 镜像”的最简模板，也可以使用仓库里的：

- `docker-compose.latest.yml`

这样做的好处是：

- 服务器不需要 Node.js / pnpm 构建环境
- 服务器只负责拉取镜像并启动
- 回滚时只需要切换 `VANBLOG_RELEASE_SUFFIX`
- 能确保部署内容与发布内容一一对应

## 2. 服务器准备

建议服务器至少具备：

- 已安装 Docker
- 已安装 `docker compose` 或 `docker-compose`
- 默认 HTTP 部署时已开放 80 端口
- 如果要启用内置 Caddy HTTPS，再额外开放 443 端口
- 有一个可持久化的数据目录

把仓库中的这些文件带到服务器：

- `docker-compose.image.yml`
- `docker-compose.latest.yml`（仅在你想直接使用 latest 简化模板时需要）
- `docker-compose.https.yml`（仅在你想启用内置 HTTPS 时需要）
- `.env.release.example`
- 如有自定义配置，可额外带上自己的 `.env`

## 3. 生成服务器环境文件

先复制模板：

```bash
cp .env.release.example .env
```

然后至少修改这些内容：

- `EMAIL`：你的邮箱，用于证书相关场景
- `VANBLOG_RELEASE_SUFFIX`：本次要部署的镜像版本，例如 `v1.0.0-<image-id>`
- `VAN_BLOG_WALINE_DATABASE_URL`：Waline 独立 PostgreSQL 数据库连接串，默认是同实例下的 `waline` 数据库
- `WALINE_JWT_TOKEN`：可选；如需手动指定 Waline 与内部控制面共用密钥可填写，否则留空让系统首次启动时自动生成
- 目录挂载项：按你的服务器实际目录调整

如果 `WALINE_JWT_TOKEN` 留空，镜像运行时会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启会继续复用这份密钥。

可选但和本文这轮缓存改造直接相关的配置：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

说明：

- 两个值都配置后，服务端才会在文章更新、RSS/sitemap/search-index 刷新后请求 Cloudflare tag/url purge。
- 如果留空，站点仍可运行，但 Cloudflare 精准 purge 会保持关闭状态，只能依赖边缘 TTL 自然过期。
- 这两个变量只会传给 `server` 容器，不需要暴露给 `website`、`admin`、`caddy`。
- URL purge 还依赖站点元数据里的 `siteInfo.baseUrl`。如果初始化或站点设置里没有填最终公网域名，Cloudflare URL purge 会跳过。

注意：

- 不要把 `postgres`、`redis` 单独映射到宿主机端口
- 不要把 Caddy admin API `2019` 暴露到公网
- 默认 HTTP-only 模式只需要暴露 `80`
- 如果叠加 `docker-compose.https.yml`，再额外暴露 `443`
- 默认官方拓扑会自动启用 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361`，不需要再额外开放 Waline 端口
- 默认镜像拓扑会把共享 Waline JWT 落盘到日志目录中的 `waline.jwt`，因此不要删除该文件所在的数据卷，除非你明确知道会导致 Waline 登录态与控制令牌轮换

## 4. 首次部署

### 4.1 推荐方式：版本化镜像部署

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

说明：

- 官方 `waline` 容器会在首次启动时尝试确保 `waline` 数据库存在，默认使用 `POSTGRES_USER` / `POSTGRES_PASSWORD` 连接 PostgreSQL。
- 如果你改成了权限受限的数据库账号，导致容器无法自动建库，请手动补建 Waline 数据库，例如：

```bash
docker compose -f docker-compose.image.yml exec postgres \
  psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-vanblog} \
  -c 'CREATE DATABASE waline;'
```

如果你的机器是老版本 Compose，也可以用：

```bash
docker-compose -f docker-compose.image.yml pull
docker-compose -f docker-compose.image.yml up -d
```

查看状态：

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f caddy server website admin waline postgres redis
```

首次启动后，访问：

```text
http://<你的域名或 IP>/admin/init
```

按页面引导完成初始化。

初始化时请特别确认：

- `siteInfo.baseUrl` 填的是最终对外访问的完整公网地址，例如 `https://blog.example.com`

如果这里留空或填错：

- Cloudflare tag purge 仍可工作
- Cloudflare URL purge 会跳过
- RSS 中依赖站点域名的绝对链接也可能不完整

### 4.2 可选：直接使用 latest 简化模板

如果你明确接受 `latest` 会随着后续发布移动，想直接使用当前目录映射与固定字段模板，可以：

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个模板的特点：

- 直接写死 `kevinchina/deeplearning:vanblog-*-latest`
- 继续使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 不需要额外准备 `.env`

但也请注意：

- 它更适合快速部署或个人维护场景
- 如果你希望上线内容可精确回滚、可审计，仍然优先使用 `docker-compose.image.yml`

### 可选：启用内置 Caddy HTTPS

如果你不打算在外层再套自己的 Caddy / Nginx，而是希望直接使用 VanBlog 内置 Caddy 申请和管理证书，可改用：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

同时请确认：

- `.env` 中把 `VAN_BLOG_CADDY_MANAGE_HTTPS=true`
- 宿主机已开放 `80/443`
- 域名已经正确解析到当前服务器

这个附加文件会做两件事：

- 把内置 Caddy 切换到 `docker/caddy/Caddyfile.https`
- 让 `server` 容器允许后台管理 HTTPS 自动重定向

## 5. 升级到新版本

假设你已经发布了新镜像，只需要更新 `.env` 里的：

```env
VANBLOG_RELEASE_SUFFIX=v1.0.0-<image-id>
```

然后执行：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

如果你启用了内置 HTTPS，则把命令改成：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

## 6. 回滚

如果新版本有问题，把 `.env` 改回旧版本即可，例如：

```env
VANBLOG_RELEASE_SUFFIX=v0.99.0-a1b2c3d4
```

再执行：

```bash
docker compose -f docker-compose.image.yml up -d
```

如果你启用了内置 HTTPS，则把命令改成：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

## 7. 常见检查项

部署后建议至少检查这些地址：

- `http://<host>/`
- `http://<host>/admin`
- `http://<host>/api/ui/`
- `http://<host>/swagger` 应返回 `404`

建议进一步确认：

- `/admin` 不会跳到 `:3002`
- 后台 CSS / JS 能正常加载
- 前台首页能打开
- 文章页能正常访问
- 评论管理页能正常打开
- Swagger 只在受信任网络或容器内可访问，不对公网暴露

## 8. AI 部署规则

如果 AI 代理要帮你部署，默认应遵守下面规则：

1. 优先读取 `README.md`、`RELEASE.md`、`DEPLOY.md`。
2. 生产部署默认使用 `docker-compose.image.yml`，而不是源码构建版 `docker-compose.yml`。
3. 默认从 `.env.release.example` 生成服务器 `.env`。
4. 不要新增 `postgres`、`redis` 的宿主机端口映射。
5. 不要新增 Caddy admin API `2019` 的宿主机端口映射。
6. 默认只对外暴露 `80`；只有启用 `docker-compose.https.yml` 时才暴露 `443`。
7. 发布版本切换优先通过 `VANBLOG_RELEASE_SUFFIX` 完成。
