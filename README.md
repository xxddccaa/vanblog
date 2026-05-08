# VanBlog

这个仓库最初源于 VanBlog，现在已经作为我独立维护的博客项目持续迭代。当前代码基线定为 `v1.6.0`，默认部署方式已经完全切换为 Docker Compose 多容器架构。

当前项目有三个明确约定：

- **核心博客栈默认不变**：`docker-compose.yml` / `docker-compose.image.yml` 继续只负责 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`
- **可选提供非 AI 单镜像入口**：`docker-compose.all-in-one*.yml` 会把主栈和 `postgres` / `redis` 收进一个容器，方便只维护一个镜像，但它不是默认推荐路径
- **镜像仓库固定使用 `kevinchina/deeplearning`**：这是当前长期保留、可回滚、可审计的备份仓库，发布与部署文档统一以它为准

我的博客地址：<https://www.dong-blog.fun/>

当前仓库开发与发布统一以 `Node.js 24.14.1` + `pnpm 10.33.0` 为基线，根目录也提供了 `.nvmrc` 与 `.node-version` 方便宿主机和 CI 对齐。

## 当前基线

- 当前代码版本：`v1.6.0`
- 默认维护分支：`master`
- 后台入口：`/admin`

## 部署路径速览

镜像部署建议保留双轨：`latest` 适合快速拉起，`image + .env` 适合锁版与回滚。

| 场景 | 组合 | 适用情况 |
| --- | --- | --- |
| 源码开发 / 本地调试 | `docker-compose.yml` | 直接从当前仓库构建，适合联调与改代码 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想维护 `.env`，希望最快拉起主栈 |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | 只想维护一个主栈镜像和一份 compose |
| 锁定正式版本 | `docker-compose.image.yml` + `.env.release.example` | 需要精确回滚、审计、记录线上版本 |
| 锁定正式版本（单镜像） | `docker-compose.all-in-one.image.yml` + `.env.release.example` | 需要单镜像回滚 |

## 核心拓扑

默认公开拓扑保持下面 7 个核心服务：

| 服务       | 端口        | 说明                                                 |
| ---------- | ----------- | ---------------------------------------------------- |
| `caddy`    | 80 / 443    | 对外统一入口，负责 `/`、`/admin`、`/api`、评论等转发 |
| `server`   | 3000        | NestJS API、站点管理接口                             |
| `website`  | 3001 / 3011 | Next.js 前台站点与控制端点                           |
| `admin`    | 3002        | Umi 构建后的后台静态页面                             |
| `waline`   | 8360 / 8361 | 评论服务与控制端点                                   |
| `postgres` | 5432        | 主业务数据库，仅在 compose 内部网络访问              |
| `redis`    | 6379        | 缓存与队列数据库，仅在 compose 内部网络访问          |

## 快速开始

### 1. 从源码直接启动

```bash
git clone https://github.com/xxddccaa/vanblog.git
cd vanblog
pnpm install
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f caddy server website admin waline postgres redis
```

首次启动后，请打开：

```text
http://<你的 IP 或域名>/admin/init
```

### 2. 使用 latest 镜像快速部署

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个方式适合快速体验主栈：

- 不需要额外准备 `.env`
- 默认使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 首次启动时会自动生成 Waline 共享 JWT，并写入 `log/waline.jwt`

### 2.1 使用单镜像 latest 快速部署

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

这个方式适合只想维护一个镜像的场景：

- 对外仍然只暴露一个 HTTP 入口
- `postgres` / `redis` 会随容器一起启动，但数据目录仍沿用 `./data/postgres`、`./data/redis`

### 3. 锁定到某个正式发布版本

```bash
cp .env.release.example .env
```

然后至少改掉：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `POSTGRES_PASSWORD`
- `WALINE_JWT_TOKEN`（可留空，首次启动会自动生成并写入 `log/waline.jwt`）

启动：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

这个方式更适合：

- 精确锁定某个版本
- 回滚到指定发布
- 明确记录线上到底跑的是哪一版镜像

## 自动化测试

当前仓库已经补上拆分部署后的自动化测试，并把测试门槛拆成三层：

```bash
pnpm test:full
pnpm test:deploy
pnpm test:blog-flow
```

说明：

- `pnpm test:deploy`：适合改 compose、路由、发布文档、部署文档之后快速校验
- `pnpm test:blog-flow`：适合验证拆分服务的真实启动、写入、访问与路由链路
- `pnpm test:full`：会顺序执行后端单测、前台单测、admin TypeScript 检查、前后台生产构建、部署配置检查和 compose 端到端流程

如果你改动了下面这些内容，建议至少重新执行一次完整回归：

- `/admin` 子路径部署相关代码
- Caddy 路由
- 服务间通信地址
- SSR / SSG 取数逻辑
- Docker / compose 编排

## 开发命令

```bash
pnpm install
pnpm dev
pnpm dev:website
pnpm build
pnpm build:admin
pnpm build:website
pnpm host:dev:up
pnpm host:dev:down
pnpm host:dev:status
```

## 发布与镜像约定

当前推荐使用 **多镜像发布**；仓库同时补充了一个可选的 all-in-one 单镜像入口，但它和旧的 `kevinchina/deeplearning:vanblog-latest` 遗留方案不是一回事。

核心镜像会发布到长期保留仓库：

```text
kevinchina/deeplearning
```

标签示例：

```text
kevinchina/deeplearning:vanblog-caddy-v1.6.0-<image-id>
kevinchina/deeplearning:vanblog-server-v1.6.0-<image-id>
kevinchina/deeplearning:vanblog-website-v1.6.0-<image-id>
kevinchina/deeplearning:vanblog-admin-v1.6.0-<image-id>
kevinchina/deeplearning:vanblog-waline-v1.6.0-<image-id>
```

## 相关文档

- [`DEPLOY.md`](./DEPLOY.md)
- [`RELEASE.md`](./RELEASE.md)
- [`docs/README.md`](./docs/README.md)
