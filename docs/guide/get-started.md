---
title: 快速上手
icon: lightbulb
order: 1
---

欢迎使用 VanBlog。当前仓库已经把部署路径拆成“源码构建”“latest 快速部署”“锁版镜像部署”三类，并补充了一个可选的 all-in-one 单镜像入口。

<!-- more -->

## 部署前准备

- 一台可运行 Docker 的 Linux 服务器
- 已安装 `docker compose`
- 如需 HTTPS，请准备好已经解析到服务器的域名
- 放行宿主机的 `80/443` 端口

## 先选部署路径

| 方式 | 文件 | 适用情况 |
| --- | --- | --- |
| 源码部署 | `docker-compose.yml` | 本地调试、二次开发、需要从当前代码直接构建 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想准备 `.env`，希望先快速把主栈跑起来 |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | 只想维护一个主栈镜像 |
| 锁版镜像部署 | `docker-compose.image.yml` + `.env.release.example` | 正式上线、精确回滚、审计线上版本 |

## 方式一：源码部署

<!-- @include: ./docker.snippet.md -->

## 方式二：使用 latest 镜像部署

### 1. 主栈 quick-start

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

### 2. 一份文件使用单镜像

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

适合：

- 想把主栈和 `postgres` / `redis` 一起收进一个 VanBlog 容器
- 仍希望沿用 `./data/postgres`、`./data/redis`、`./log` 这些宿主机目录

如果你连 compose 文件都不想维护，也可以直接：

```bash
docker run -d \
  --name vanblog \
  --restart always \
  --init \
  --shm-size 1g \
  -p 80:80 \
  -v "$(pwd)/data/static:/app/static" \
  -v "$(pwd)/log:/var/log" \
  -v "$(pwd)/caddy/config:/root/.config/caddy" \
  -v "$(pwd)/caddy/data:/root/.local/share/caddy" \
  -v "$(pwd)/aliyunpan/config:/root/.config/aliyunpan" \
  -v "$(pwd)/data/postgres:/var/lib/postgresql/data" \
  -v "$(pwd)/data/redis:/data/redis" \
  kevinchina/deeplearning:vanblog-all-in-one-latest
```

这个镜像现在已经内置了和 `docker-compose.all-in-one.latest.yml` 一致的默认环境变量；但端口映射、数据卷挂载、重启策略这些宿主机参数，仍然需要你在 `docker run` 时自己显式传入。

## 方式三：使用版本锁定镜像部署

### 1. 准备环境变量

```bash
cp .env.release.example .env
```

然后至少修改这些变量：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `POSTGRES_PASSWORD`
- `WALINE_JWT_TOKEN`（可选）

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
