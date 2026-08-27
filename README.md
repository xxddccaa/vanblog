# VanBlog

这个仓库最初源于 VanBlog，现在已经作为我独立维护的博客项目持续迭代。当前代码基线为 `v1.8.3`，默认部署方式已经完全切换为 Docker Compose 多容器架构。

当前项目有三个明确约定：

- **核心博客栈默认不变**：`docker-compose.yml` / `docker-compose.image.yml` 继续只负责 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`
- **可选提供非 AI 单镜像入口**：`docker-compose.all-in-one*.yml` 会把主栈和 `postgres` / `redis` 收进一个容器，方便只维护一个镜像，但它不是默认推荐路径
- **镜像仓库固定使用 `kevinchina/deeplearning`**：这是当前长期保留、可回滚、可审计的备份仓库，发布与部署文档统一以它为准

我的博客地址：<https://www.dong-blog.fun/>

当前仓库开发与发布统一以 `Node.js 22.22.2` + `pnpm 10.33.0` 为基线，根目录也提供了 `.nvmrc` 与 `.node-version` 方便宿主机和 CI 对齐。

## 当前基线

- 当前代码版本：`v1.8.2`
- 默认维护分支：`master`
- 后台入口：`/admin`

## 部署路径速览

镜像部署建议保留双轨：`latest` 适合快速拉起，`image + .env` 适合锁版与回滚。

| 场景 | 组合 | 适用情况 |
| --- | --- | --- |
| 源码开发 / 本地调试 | `docker-compose.yml` | 直接从当前仓库构建，适合联调与改代码 |
| latest 快速部署 | `docker-compose.latest.yml` + `.env` | 使用最新主栈镜像，并显式提供数据库随机密码 |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | 单机生产推荐：只维护一个镜像和一份 compose（本人线上用法，见 2.1） |
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
printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
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
printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个方式适合快速体验主栈：

- PostgreSQL 与 Redis 密码必须通过 `.env` 显式提供，避免共享默认凭证
- 默认使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 首次启动时会自动生成 Waline 共享 JWT，并写入 `log/waline.jwt`

### 2.1 单镜像 all-in-one 部署（生产推荐，本人线上用法）

`all-in-one` 把 `caddy + server + website + admin + waline + postgres + redis` 全部收进一个容器，对外只暴露一个 HTTP 端口，配套一个 `kroki` 容器负责图表渲染。只需维护一份 compose，非常适合单机部署，也是我线上博客实际使用的方式。

**约定：一个博客实例 = 一个独立目录**。目录名就是 compose 项目名，容器、网络、数据卷都按它自动隔离，所以同一台机器可以并存多个互不干扰的实例。

```bash
# 1) 为这个实例建一个独立目录
mkdir -p /srv/vanblog && cd /srv/vanblog

# 2) 取来 all-in-one compose（用仓库里的版本，不要用别处的旧副本）
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

首次启动约 40–60 秒内变为 `healthy`，随后：

```bash
docker compose -f docker-compose.all-in-one.latest.yml ps      # 等到 healthy
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8019/ # 期望 200
```

然后浏览器打开 `http://<你的 IP 或域名>:8019/admin/` 完成首次初始化（建管理员账号）。

要点说明：

- **端口**：compose 默认对外 `80`；线上一般放在反向代理 / Cloudflare 之后，用 `.env` 里的 `VANBLOG_HTTP_PORT` 钉死一个内部端口（例如 `8019`）。
- **密码自动生成（v1.8.0 安全整改）**：`POSTGRES_PASSWORD` / `REDIS_PASSWORD` 留空时，容器首次启动会生成随机强口令并持久化到 `./log/vanblog-secrets/`（及 `./secrets/`），server 自动使用同一份。**不要**在 `.env` 里把它设成弱口令 `postgres`——入口脚本会拒绝弱口令并改用随机值，若同时又硬编码了旧式 `VAN_BLOG_DATABASE_URL=...postgres:postgres...` 会导致连库失败。仓库版 compose 已把这些默认留空，直接用即可。
- **数据落盘**：全部挂在实例目录下（`./data/postgres`、`./data/redis`、`./data/static`、`./log`、`./caddy`、`./secrets` 等），备份 / 迁移整目录即可。
- **多实例**：想再开一个站点，就换一个目录 + 换一个 `VANBLOG_HTTP_PORT`，重复上面步骤；两个实例的容器与数据天然隔离。

#### 升级到新版本

`all-in-one-latest` 标签每次发版都会同步到最新正式版，因此升级只需在实例目录里重新拉取：

```bash
cd /srv/vanblog
# 升级前建议先备份（compose + 逻辑导出）
cp docker-compose.all-in-one.latest.yml docker-compose.all-in-one.latest.yml.bak
docker exec "$(docker compose ps -q vanblog)" sh -c 'su-exec postgres pg_dumpall' > pg_dumpall.$(date +%Y%m%d).sql

# 如从旧版本升级，务必把 compose 换成仓库最新版（旧副本可能仍硬编码弱口令，见上）
curl -fsSL -o docker-compose.all-in-one.latest.yml \
  https://raw.githubusercontent.com/xxddccaa/vanblog/master/docker-compose.all-in-one.latest.yml

docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

数据目录 `./data` 会被复用，博客内容不受影响；从旧版首次升到 v1.8.0 时，PostgreSQL 密码会被轮换为随机强口令，属预期行为，可自愈。

### 3. 锁定到某个正式发布版本

```bash
cp .env.release.example .env
```

然后至少改掉：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
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
kevinchina/deeplearning:vanblog-caddy-v1.8.2-<image-id>
kevinchina/deeplearning:vanblog-server-v1.8.2-<image-id>
kevinchina/deeplearning:vanblog-website-v1.8.2-<image-id>
kevinchina/deeplearning:vanblog-admin-v1.8.2-<image-id>
kevinchina/deeplearning:vanblog-waline-v1.8.2-<image-id>
```

单镜像 all-in-one 入口则额外发布下面这组标签（每次发版会同步 `-latest`）：

```text
kevinchina/deeplearning:vanblog-all-in-one-v1.8.2-<image-id>
kevinchina/deeplearning:vanblog-all-in-one-v1.8.2
kevinchina/deeplearning:vanblog-all-in-one-latest
```

## 相关文档

- [`DEPLOY.md`](./DEPLOY.md)
- [`RELEASE.md`](./RELEASE.md)
- [`docs/README.md`](./docs/README.md)
