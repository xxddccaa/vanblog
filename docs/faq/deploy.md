---
title: 部署常见问题
icon: rocket
order: 1
---

## 应该用哪个 docker compose 文件

可以按下面理解：

- `docker-compose.yml`：源码构建，适合开发和联调
- `docker-compose.latest.yml`：latest 主栈 quick-start
- `docker-compose.image.yml`：锁定正式版本部署
- `docker-compose.all-in-one.latest.yml` / `docker-compose.all-in-one.image.yml`：单镜像部署

## 如何部署到 CDN

当前仓库的前台静态资源主要来自 Next.js 的 `/_next/static`。如果你要接入 CDN，建议只优先缓存这一类静态资源。

## 如何安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

## 如何在外部访问数据库

默认情况下，`postgres` 只在 compose 内部网络开放，这样更安全。

如果你只是临时排查数据，优先推荐直接进入容器：

```bash
docker compose exec postgres psql -U postgres -d vanblog
```

## 部署后无法访问后台

可以按下面顺序排查：

1. 后台入口是否访问了 `http://<域名>/admin`
2. `caddy`、`server`、`website`、`admin`、`waline` 是否都已健康启动
3. 宿主机的 `80/443` 端口是否真的放行
4. 是否错误地把外层反代直接指向了 `server` 或 `admin`
5. 用 `docker compose logs -f caddy server website admin waline postgres redis` 查看报错

## docker 镜像拉取慢

可以为 Docker 配置镜像加速器，或在网络条件允许时提前拉取所需镜像。

## 端口被占用

如果宿主机的 `80` 或 `443` 已被其他服务占用，可以调整 compose 中 `caddy` 的宿主机端口映射。

## 部署后出现数据库连接错误

请优先检查 `server` 服务里的 `VAN_BLOG_DATABASE_URL` 是否和 `postgres` 服务保持一致。

## 外层反向代理后页面跳转或静态资源异常

请确保外层代理的是 VanBlog 的统一入口 `caddy`，而不是内部服务端口。

## 无法通过 HTTPS + IP 访问

当前不支持通过 `HTTPS + IP` 的方式直接访问站点。请使用：

- `HTTPS + 域名`
- 或 `HTTP + IP`

## 还没定位到问题怎么办

请整理以下信息后提交 Issue：

- 使用的是 `docker-compose.yml`、`docker-compose.latest.yml` 还是 `docker-compose.image.yml`
- `docker compose ps` 的结果
- `docker compose logs -f caddy server website admin waline postgres redis` 中的关键错误
- 你是否额外套了 Nginx / Caddy / CDN
