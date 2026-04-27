# VanBlog

这个仓库最初源于 VanBlog，现在已经作为我独立维护的博客项目持续迭代。当前代码基线定为 `v1.5.5`，默认部署方式已经完全切换为 Docker Compose 多容器架构。

这版开始，仓库除了原有博客主栈，还提供一套**可选启用**的 AI 工作台能力：后台管理员可以在 `/admin/ai` 使用基于博客知识检索增强的问答，但这部分不会并入默认部署，也不会影响不需要 AI 的用户。

当前项目有三个明确约定：

- **核心博客栈默认不变**：`docker-compose.yml` / `docker-compose.image.yml` 继续只负责 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`
- **AI / FastGPT 是可选覆盖层**：只有显式叠加 `docker-compose.ai-qa.yml`，才会让 `server` 连接 FastGPT；只有再叠加 `docker-compose.fastgpt.yml`，才会启动 bundled FastGPT
- **镜像仓库固定使用 `kevinchina/deeplearning`**：这是当前长期保留、可回滚、可审计的备份仓库，发布与部署文档统一以它为准

我的博客地址：<https://www.dong-blog.fun/>

当前仓库开发与发布统一以 `Node.js 24.14.1` + `pnpm 10.33.0` 为基线，根目录也提供了 `.nvmrc` 与 `.node-version` 方便宿主机和 CI 对齐。

## 当前基线

- 当前代码版本：`v1.5.5`
- 默认维护分支：`master`
- 后台入口：`/admin`
- AI 工作台入口：`/admin/ai`
- AI 工作台权限：所有管理员可见（`access: isAdmin`）
- AI 会话策略：会话记录写入数据库，并在管理员之间共享历史
- AI 回答策略：优先参考已同步到 FastGPT 的博客知识；没有直接覆盖时，也允许结合通用知识补充说明

## 部署路径速览

镜像部署建议保留双轨：`latest` 适合快速拉起，`image + .env` 适合锁版与回滚。AI 也是按需叠加，不强行并入默认部署。

| 场景 | 组合 | 适用情况 |
| --- | --- | --- |
| 源码开发 / 本地调试 | `docker-compose.yml` | 直接从当前仓库构建，适合联调与改代码 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想维护 `.env`，希望最快拉起主栈 |
| latest 一文件 + AI | `docker-compose.latest.ai.yml` | 想用一份 compose 同时拉起主栈和 bundled FastGPT |
| 锁定正式版本 | `docker-compose.image.yml` + `.env.release.example` | 需要精确回滚、审计、记录线上版本 |
| 锁版 + AI | `docker-compose.image.yml` + `docker-compose.ai-qa.yml` + `docker-compose.fastgpt.yml` | 生产环境按需启用 AI 工作台 |

如果你和我现在的生产目录一样，平时只想维护两份 quick-start 文件，也完全可以：

- `docker-compose.yaml`：你自己保存的 latest 主栈文件，不启用 AI
- `docker-compose.latest.ai.yml`：一份文件直接带 AI 工作台与 bundled FastGPT

对应命令就是：

```bash
# 不启用 AI
docker compose pull
docker compose up -d

# 启用 AI
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

仓库里仍然保留 `docker-compose.ai-qa.yml` 和 `docker-compose.fastgpt.yml`，因为它们对“锁版部署”“只接已有 FastGPT”“自动化测试”和“模块化排障”仍然有用；如果你只复用上面这两份 quick-start 文件，日常可以先忽略它们。

## 核心拓扑

默认公开拓扑保持下面 7 个核心服务：

| 服务       | 端口        | 说明                                                 |
| ---------- | ----------- | ---------------------------------------------------- |
| `caddy`    | 80 / 443    | 对外统一入口，负责 `/`、`/admin`、`/api`、评论等转发 |
| `server`   | 3000        | NestJS API、站点管理、AI 工作台后端接口              |
| `website`  | 3001 / 3011 | Next.js 前台站点与控制端点                           |
| `admin`    | 3002        | Umi 构建后的后台静态页面                             |
| `waline`   | 8360 / 8361 | 评论服务与控制端点                                   |
| `postgres` | 5432        | 主业务数据库，仅在 compose 内部网络访问              |
| `redis`    | 6379        | 缓存与队列数据库，仅在 compose 内部网络访问          |

可选 AI 扩展不会改掉这套默认拓扑，而是额外叠加：

- `docker-compose.ai-qa.yml`：只给 `server` 注入 FastGPT 私网地址与 root 密码
- `docker-compose.fastgpt.yml`：启动 bundled FastGPT 及其依赖，默认只绑定到 `127.0.0.1`
- `docker-compose.latest.ai.yml`：把 `docker-compose.latest.yml`、`docker-compose.ai-qa.yml`、`docker-compose.fastgpt.yml` 合成一份 quick-start 文件

当前 bundled FastGPT 固定使用下面 4 个 `kevinchina/deeplearning` 备份标签：

- `kevinchina/deeplearning:fastgpt-v4.14.10.2`
- `kevinchina/deeplearning:fastgpt-plugin-v0.5.6`
- `kevinchina/deeplearning:aiproxy-v0.3.5`
- `kevinchina/deeplearning:fastgpt-code-sandbox-v4.14.10`

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

如果你想用“一份 compose 文件”同时把博客主栈和 bundled FastGPT 一起拉起来，也可以直接使用：

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

这个文件适合快速体验 AI 工作台；如果你需要精确锁版与回滚，仍然优先使用 `docker-compose.image.yml`。其中 bundled FastGPT 的 4 个关键镜像已经改为从 `kevinchina/deeplearning` 备份标签拉取，避免后续直接依赖上游 GHCR tag。

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

## 可选：启用 AI 工作台 / FastGPT

AI 工作台是 `v1.4.0` 开始引入的重大功能，但它是**按需部署**的：

- 不需要 AI 的用户，继续使用默认 compose 即可
- 已有私有 FastGPT 的用户，只需叠加 `docker-compose.ai-qa.yml`
- 想在同机跑 bundled FastGPT 的用户，再额外叠加 `docker-compose.fastgpt.yml`

示例：

```bash
# 只连接已有私有 FastGPT
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d

# 同时启动 bundled FastGPT
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

后台使用方式：

- 管理员入口：`/admin/ai`
- 页面分为 `博客问答`、`配置中心`、`OpenCode 终端` 三个 tab
- `配置中心` 用于填写对话模型、向量模型、Dataset / App / API Key 等信息
- `博客问答` 会把历史会话落库，支持回看、继续追问、重命名、删除
- `OpenCode 终端` 只在 AI overlay 启用时开放；它复用现有 `server` 容器，把当前部署目录挂到 `/workspace/vanblog`，并把终端 HOME 持久化到 `./data/ai-terminal/home`
- bundled FastGPT 的完整操作、提示词策略、`/chat/completions` 与 `/embeddings` 的职责边界、版本固化说明，统一见 [`docs/ai-qa-fastgpt.md`](docs/ai-qa-fastgpt.md)

## 自动化测试

当前仓库已经补上拆分部署后的自动化测试，并把测试门槛拆成三层：

```bash
# 一键完整回归（发版前推荐）
pnpm test:full

# 部署配置和文档约束检查
pnpm test:deploy

# 完整 compose 烟雾流转测试
pnpm test:blog-flow
```

说明：

- `pnpm test:deploy`：适合改 compose、路由、发布文档、部署文档之后快速校验
- `pnpm test:blog-flow`：适合验证拆分服务的真实启动、写入、访问与路由链路
- `pnpm test:full`：会顺序执行后端单测、前台单测、admin TypeScript 检查、前后台生产构建、部署配置检查和 compose 端到端流程，适合作为升级、发版、合并前的标准回归命令

如果你改动了下面这些内容，建议至少重新执行一次完整回归：

- `/admin` 子路径部署相关代码
- Caddy 路由
- 服务间通信地址
- SSR / SSG 取数逻辑
- Docker / compose 编排
- AI / FastGPT 可选部署文档与配置约束

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

当前推荐使用 **多镜像发布**，而不是旧的单镜像 `kevinchina/deeplearning:vanblog-latest`。

核心镜像会发布到长期保留仓库：

```text
kevinchina/deeplearning
```

标签示例：

```text
kevinchina/deeplearning:vanblog-caddy-v1.5.5-<image-id>
kevinchina/deeplearning:vanblog-server-v1.5.5-<image-id>
kevinchina/deeplearning:vanblog-website-v1.5.5-<image-id>
kevinchina/deeplearning:vanblog-admin-v1.5.5-<image-id>
kevinchina/deeplearning:vanblog-waline-v1.5.5-<image-id>
```

说明：

- `pnpm release:images` / `pnpm release:images:push` 只发布 VanBlog 核心 5 个镜像
- AI 工作台代码已经包含在 `server` / `admin` 核心镜像里，但 bundled FastGPT 仍然通过 `docker-compose.fastgpt.yml` 固定到当前验证过的上游版本，不并入默认镜像发布
- 如需对 FastGPT 依赖做长期留档，可按 [`docs/ai-qa-fastgpt.md`](docs/ai-qa-fastgpt.md) 里的版本矩阵自行镜像到你的私有仓库或 `kevinchina/deeplearning` 下的备份标签，但不要在未验证前随意改 compose
- bundled FastGPT 以后默认沿用当前这套已验证版本；除非你明确决定重新评估上游 FastGPT 技术栈，否则不主动改 AI 依赖基线

常用发版命令：

```bash
# 本地构建镜像
pnpm release:images

# 正式发版
pnpm release:publish

# 只补 latest 别名
pnpm release:latest
```

详细说明请看：

- [`RELEASE.md`](RELEASE.md)
- [`DEPLOY.md`](DEPLOY.md)
- [`docs/releases/README.md`](docs/releases/README.md)
- [`docs/releases/v1.5.5.md`](docs/releases/v1.5.5.md)

## 文档入口

如果后续让 AI 帮你维护这个仓库，优先让它先读：

- [`README.md`](README.md)
- [`RELEASE.md`](RELEASE.md)
- [`DEPLOY.md`](DEPLOY.md)
- [`docs/ai-qa-fastgpt.md`](docs/ai-qa-fastgpt.md)
- [`AGENTS.md`](AGENTS.md)
- [`CLAUDE.md`](CLAUDE.md)

这样 AI 更容易理解：

- 当前是多容器部署，不再是旧单容器结构
- `/admin` 必须走 Caddy 子路径代理
- `kevinchina/deeplearning` 是当前长期保留的镜像仓库
- `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml` 只是可选覆盖层
- 默认部署不需要 AI；需要 AI 时再显式叠加

## 当前维护方向

这份仓库是基于自己的使用习惯持续修改的，主要方向包括：

- 管理后台列表和分页体验优化
- 前台分类导航和代码块展示优化
- Mermaid / LaTeX / 私密文档 / 搜索 / 音乐 / 隐私设置等能力增强
- AI 工作台、博客知识问答与可选 FastGPT 部署能力
