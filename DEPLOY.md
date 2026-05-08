# 生产部署指南

这份文档面向需要把已经发布好的 VanBlog 多镜像部署到服务器的人类维护者和 AI 代理。

如果你要做的是“构建并发布镜像”，请看 `RELEASE.md`；如果你要做的是“把已经发布好的镜像部署到服务器”，请看这份文档。

当前代码基线已经推进到 `v1.6.1`，生产部署文档也统一以 `kevinchina/deeplearning` 这套长期保留镜像仓库为准。

## 1. 部署矩阵

当前建议把部署方式理解成三层：源码构建、latest 快速部署、版本锁定部署，再加一个可选的 all-in-one 单镜像部署。

| 目标 | 推荐文件 | 适用情况 |
| --- | --- | --- |
| 本地开发 / 改代码 | `docker-compose.yml` | 从源码构建，适合调试与联调 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想维护 `.env`，直接拉取 `latest` 主栈 |
| 锁定某个正式版本 | `docker-compose.image.yml` + `.env.release.example` | 需要精确回滚、审计、复现线上版本 |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | 只想维护一个主栈镜像 |
| 锁版单镜像 | `docker-compose.all-in-one.image.yml` + `.env.release.example` | 需要单镜像回滚 |

双轨说明：

- `docker-compose.latest.yml` 适合快速部署、个人维护、先把服务跑起来
- `docker-compose.image.yml` + `.env.release.example` 适合正式发布、锁版、回滚、审计
- `docker-compose.all-in-one.latest.yml` / `docker-compose.all-in-one.image.yml` 适合希望线上只维护一个 VanBlog 容器的场景

## 2. 服务器准备

建议服务器至少具备：

- 已安装 Docker
- 已安装 `docker compose` 或 `docker-compose`
- 默认 HTTP 部署时已开放 80 端口
- 如果要启用内置 Caddy HTTPS，再额外开放 443 端口
- 有一组可持久化的数据目录

把仓库中的这些文件带到服务器：

- `docker-compose.latest.yml`
- `docker-compose.image.yml`
- `docker-compose.all-in-one.latest.yml`
- `docker-compose.all-in-one.image.yml`
- `docker-compose.https.yml`
- `.env.release.example`
- 如有自定义配置，可额外带上自己的 `.env`

注意：

- 不要把 `postgres`、`redis` 单独映射到宿主机端口
- 不要把 Caddy admin API `2019` 暴露到公网
- 默认 HTTP-only 模式只需要暴露 `80`
- 如果叠加 `docker-compose.https.yml`，再额外暴露 `443`
- 默认官方拓扑会自动启用 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361`，不需要再额外开放 Waline 端口
- 默认镜像拓扑会把共享 Waline JWT 落盘到日志目录中的 `waline.jwt`

## 3. 如需锁版部署：生成服务器环境文件

先复制模板：

```bash
cp .env.release.example .env
```

然后至少修改这些内容：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `POSTGRES_PASSWORD`
- `VAN_BLOG_WALINE_DATABASE_URL`
- `WALINE_JWT_TOKEN`
- 目录挂载项

如果 `WALINE_JWT_TOKEN` 留空，镜像运行时会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启会继续复用这份密钥。

可选但常用的配置：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

## 4. 首次部署

### 4.1 latest 快速部署：主栈

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个模板的特点：

- 直接写死 `kevinchina/deeplearning:vanblog-*-latest`
- 继续使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 不需要额外准备 `.env`

### 4.2 锁版部署：版本化镜像

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

说明：

- 官方 `waline` 容器会在首次启动时尝试确保 `waline` 数据库存在
- 如果你改成了权限受限的数据库账号，导致容器无法自动建库，请手动补建 Waline 数据库

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

### 4.3 可选：启用内置 Caddy HTTPS

如果你不打算在外层再套自己的 Caddy / Nginx，而是希望直接使用 VanBlog 内置 Caddy 申请和管理证书，可改用：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

同时请确认：

- `.env` 中把 `VAN_BLOG_CADDY_MANAGE_HTTPS=true`
- 宿主机已开放 `80/443`
- 域名已经正确解析到当前服务器

## 5. 单镜像部署

如果你希望线上只维护一个容器，可以使用：

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

或锁版：

```bash
docker compose -f docker-compose.all-in-one.image.yml pull
docker compose -f docker-compose.all-in-one.image.yml up -d
```

这个路径仍然会把 PostgreSQL、Redis、Caddy、server、website、admin、waline 都收进一个容器，但数据目录仍走宿主机挂载。

## 6. 上线后建议检查

- `http://<你的域名>/admin` 是否正常打开
- `http://<你的域名>/admin/init` 是否只在未初始化时出现
- 前台首页、文章页、分类页、标签页是否正常访问
- 评论、图片、RSS 是否仍可访问
- `docker compose logs -f caddy server website admin waline postgres redis` 是否有明显报错

## 7. 最小结论

如果你只是想稳定上线博客主栈：

1. 生产推荐 `docker-compose.image.yml` + `.env.release.example`
2. 快速试跑用 `docker-compose.latest.yml`
3. 想少维护一个容器时，用 `docker-compose.all-in-one*.yml`
