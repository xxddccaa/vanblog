---
title: 快速上手
icon: lightbulb
order: 1
---

欢迎使用 VanBlog。当前仓库默认提供两种部署路径：

- **源码部署**：适合本地调试、二次开发、直接从仓库构建
- **镜像部署**：适合生产环境，直接使用已发布的多镜像版本

<!-- more -->

## 部署前准备

建议至少准备以下条件：

- 一台可运行 Docker 的 Linux 服务器
- 已安装 `docker compose`
- 如需 HTTPS，请准备好已经解析到服务器的域名
- 放行宿主机的 `80/443` 端口

## 方式一：源码部署

<!-- @include: ./docker.snippet.md -->

## 方式二：使用已发布镜像部署

更适合生产环境或固定版本部署。

### 1. 准备环境变量

```bash
cp .env.release.example .env
```

然后至少修改这些变量：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `WALINE_JWT_TOKEN`

### 2. 启动服务

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 3. 查看状态与日志

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f caddy server website admin postgres redis
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
- API 文档：`http://<你的域名或 IP>/swagger`
- 评论前台：如启用了外部 Waline，请访问你配置的评论服务地址

## 下一步建议

- 如果你要做服务器准备，可以继续看 [从零开始](./head.md)
- 如果你已经完成安装，建议继续看 [初始化](./init.md)
- 如果你准备上线生产环境，建议优先阅读根目录的 `DEPLOY.md` 与 `RELEASE.md`
