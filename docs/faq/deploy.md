---
title: 部署常见问题
icon: rocket
order: 1
---

## 如何部署到 CDN

当前仓库的前台静态资源主要来自 Next.js 的 `/_next/static`。如果你要接入 CDN，建议只优先缓存这一类静态资源。

如果你确实需要给前台资源加前缀，可以在 `website` 服务中增加 `VAN_BLOG_CDN_URL` 环境变量，例如：

```yaml
environment:
  VAN_BLOG_CDN_URL: https://cdn.example.com
```

修改后重新启动 `website` 服务即可生效。

## 如何安装 Docker

可以先安装 Docker：

```bash
curl -fsSL https://get.docker.com | sh
```

安装完成后再确认：

```bash
docker --version
docker compose version
```

## 如何在外部访问数据库

默认情况下，`mongo` 只在 compose 内部网络开放，这样更安全。

如果你只是临时排查数据，优先推荐直接进入容器：

```bash
docker compose exec mongo mongo vanBlog
```

如果你一定要让宿主机外部访问 MongoDB，请自行评估安全风险，并在 `mongo` 服务里显式增加端口映射，例如：

```yaml
ports:
  - "27017:27017"
```

然后重新启动服务：

```bash
docker compose up -d
```

## 部署后无法访问后台

可以按下面顺序排查：

1. 后台入口是否访问了 `http://<域名>/admin`，而不是直连 `:3002`
2. `caddy`、`server`、`website`、`admin` 是否都已健康启动
3. 宿主机的 `80/443` 端口是否真的放行
4. 是否错误地把外层反代直接指向了 `server` 或 `admin`
5. 用 `docker compose logs -f caddy server website admin waline mongo` 查看报错

## docker 镜像拉取慢

可以为 Docker 配置镜像加速器，或在网络条件允许时提前拉取所需镜像。

## 端口被占用

如果宿主机的 `80` 或 `443` 已被其他服务占用，可以调整 compose 中 `caddy` 的宿主机端口映射，例如：

```yaml
ports:
  - "8080:80"
  - "8443:443"
```

同时也别忘了同步调整外层防火墙和访问地址。

## 部署后出现数据库连接错误

请优先检查 `server` 服务里的 `VAN_BLOG_DATABASE_URL` 是否和 `mongo` 服务保持一致。

默认值应类似：

```text
mongodb://mongo:27017/vanBlog?authSource=admin
```

如果你改过数据库服务名、端口或鉴权参数，需要一起改这里。

## 外层反向代理后页面跳转或静态资源异常

请确保外层代理的是 VanBlog 的统一入口 `caddy`，而不是内部服务端口。

推荐继续参考：[反代](../reference/reverse-proxy.md)

## 无法通过 HTTPS + IP 访问

当前不支持通过 `HTTPS + IP` 的方式直接访问站点。请使用：

- `HTTPS + 域名`
- 或 `HTTP + IP`（且关闭 HTTPS 自动重定向）

## 还没定位到问题怎么办

请整理以下信息后提交 Issue：

- 使用的是 `docker-compose.yml` 还是 `docker-compose.image.yml`
- `docker compose ps` 的结果
- `docker compose logs -f caddy server website admin waline mongo` 中的关键错误
- 你是否额外套了 Nginx / Caddy / CDN

Issue 地址：<https://github.com/xxddccaa/vanblog/issues/new/choose>
