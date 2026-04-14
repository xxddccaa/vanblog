---
title: 快速上手
icon: lightbulb
order: 1
---

欢迎使用 VanBlog。当前仓库默认提供两种部署路径：

- **源码部署**：适合本地调试、二次开发、直接从仓库构建
- **镜像部署**：默认推荐直接使用 `docker-compose.latest.yml`；如需锁定版本再使用 `docker-compose.image.yml`

<!-- more -->

## 部署前准备

建议至少准备以下条件：

- 一台可运行 Docker 的 Linux 服务器
- 已安装 `docker compose`
- 如需 HTTPS，请准备好已经解析到服务器的域名
- 放行宿主机的 `80/443` 端口

## 方式一：源码部署

<!-- @include: ./docker.snippet.md -->

## 方式二：使用 latest 镜像部署（默认推荐）

适合想直接复用当前目录结构、快速拉起服务的场景。

### 1. 直接启动

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

### 2. 说明

- 不需要额外准备 `.env`
- 默认使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- Waline 共享密钥会在首次启动时自动生成，并写入 `log/waline.jwt`

## 方式三：使用版本锁定镜像部署

更适合生产环境固定版本、精确回滚或审计部署内容的场景。

### 1. 准备环境变量

```bash
cp .env.release.example .env
```

然后至少修改这些变量：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `WALINE_JWT_TOKEN`（可选）

未设置 `WALINE_JWT_TOKEN` 时，`docker-compose.image.yml` 会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启继续复用。

### 2. 启动服务

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 3. 查看状态与日志

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f caddy server website admin waline postgres redis
```

### 4. 完成初始化

打开：

```text
http://<你的域名或 IP>/admin/init
```

根据页面提示完成初始化。

## 初始化完成后你可以访问

- 前台首页：`http://<你的域名或 IP>/`
- 后台管理：`http://<你的域名或 IP>/admin`
- 评论管理：`http://<你的域名或 IP>/api/ui/`

默认通过 Caddy 的公网入口不会暴露 Swagger。若需查看 API 文档，请直接通过主机本地或容器内的 `server` 服务入口访问，不要依赖 `http://<你的域名或 IP>/swagger` 这个公网地址。

## 下一步建议

- 如果你要做服务器准备，可以继续看 [从零开始](./head.md)
- 如果你已经完成安装，建议继续看 [初始化](./init.md)
- 如果你准备上线生产环境，建议优先阅读根目录的 `DEPLOY.md` 与 `RELEASE.md`
