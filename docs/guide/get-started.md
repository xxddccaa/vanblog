---
title: 快速上手
icon: lightbulb
order: 1
---

欢迎使用 VanBlog。当前仓库已经把部署路径拆成“源码构建”“latest 快速部署”“锁版镜像部署”三类，AI 工作台则作为可选覆盖层单独叠加。

<!-- more -->

## 部署前准备

建议至少准备以下条件：

- 一台可运行 Docker 的 Linux 服务器
- 已安装 `docker compose`
- 如需 HTTPS，请准备好已经解析到服务器的域名
- 放行宿主机的 `80/443` 端口

## 先选部署路径

| 方式 | 文件 | 适用情况 |
| --- | --- | --- |
| 源码部署 | `docker-compose.yml` | 本地调试、二次开发、需要从当前代码直接构建 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想准备 `.env`，希望先快速把主栈跑起来 |
| latest 一文件 + AI | `docker-compose.latest.ai.yml` | 想直接用一份 compose 拉起主栈和 bundled FastGPT |
| 锁版镜像部署 | `docker-compose.image.yml` + `.env.release.example` | 正式上线、精确回滚、审计线上版本 |

双轨说明：

- `docker-compose.latest.yml` / `docker-compose.latest.ai.yml` 适合快速体验与个人维护
- `docker-compose.image.yml` 适合正式上线、版本审计与回滚
- 两条镜像部署路径并列保留，不互相替代

## 方式一：源码部署

<!-- @include: ./docker.snippet.md -->

## 方式二：使用 latest 镜像部署

### 1. 主栈 quick-start

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

说明：

- 不需要额外准备 `.env`
- 默认使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- Waline 共享密钥会在首次启动时自动生成，并写入 `log/waline.jwt`

### 2. 一份文件直接带 AI

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

适合：

- 想快速体验 `/admin/ai`
- 想直接使用 bundled FastGPT
- 暂时不关心精确锁版回滚

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
- `POSTGRES_PASSWORD`
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

## 可选：启用 AI 工作台

AI 工作台是 `v1.4.0` 开始引入的可选能力，不会影响默认博客部署。

常见组合：

```bash
# 连接已有私有 FastGPT
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d

# 同机启动 bundled FastGPT
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

后台入口：

- `http://<你的域名或 IP>/admin/ai`

页面说明：

- `博客问答`：管理员共享历史会话、继续追问、删除 / 重命名
- `配置中心`：填写 `Dataset ID`、`App ID`、`API Key`、`/chat/completions`、`/embeddings` 等配置

推荐先看：[AI 工作台使用指南](./ai-workspace.md)

运维、compose 组合、排障与 bundled FastGPT 结构说明见：[AI 工作台 / FastGPT 操作清单](../ai-qa-fastgpt.md)

## 初始化完成后你可以访问

- 前台首页：`http://<你的域名或 IP>/`
- 后台管理：`http://<你的域名或 IP>/admin`
- 评论管理：`http://<你的域名或 IP>/api/ui/`

默认通过 Caddy 的公网入口不会暴露 Swagger。若需查看 API 文档，请直接通过主机本地或容器内的 `server` 服务入口访问，不要依赖 `http://<你的域名或 IP>/swagger` 这个公网地址。

## 下一步建议

- 如果你要做服务器准备，可以继续看 [从零开始](./head.md)
- 如果你已经完成安装，建议继续看 [初始化](./init.md)
- 如果你准备上线生产环境，建议优先阅读根目录的 `DEPLOY.md` 与 `RELEASE.md`
