# 发布指南

这份文档同时面向人工维护者和 AI 代理。

目标有三个：

- 统一本仓库的构建、打包、发版与部署方式
- 明确多镜像发布规范，避免再回到单镜像 `kevinchina/deeplearning:vanblog-latest` 的不可追踪模式
- 把 `v1.4.0` 引入的 AI 工作台、可选 FastGPT 部署、文档与测试规则固化下来

当前代码基线已经推进到 `v1.4.0`，默认镜像仓库继续固定为长期保留的 `kevinchina/deeplearning`。

## 1. 发布边界

先明确当前仓库的发布边界：

- VanBlog 核心发布物是 5 个镜像：`caddy`、`server`、`website`、`admin`、`waline`
- 数据库和缓存继续使用运行时官方镜像：`postgres:16-alpine`、`redis:7-alpine`
- AI 工作台代码已经包含在 `server` / `admin` 核心镜像里，因此发布核心镜像时，AI 页面与接口会随版本一起进入 VanBlog 主栈
- 但是 bundled FastGPT 依赖不属于默认镜像发布范围，仍然通过 `docker-compose.fastgpt.yml` 单独管理
- `pnpm release:images` / `pnpm release:images:push` 不会构建或推送 FastGPT 镜像
- bundled FastGPT 当前是“固定版本基线”；除非你明确决定重新评估 FastGPT 上游技术更新，否则以后发布 VanBlog 时不主动改 AI 依赖矩阵
- 当前验证过的 4 个关键 FastGPT 镜像已经备份到 `kevinchina/deeplearning`，并由 `docker-compose.fastgpt.yml` / `docker-compose.latest.ai.yml` 直接引用：
  - `kevinchina/deeplearning:fastgpt-v4.14.10.2`
  - `kevinchina/deeplearning:fastgpt-plugin-v0.5.6`
  - `kevinchina/deeplearning:aiproxy-v0.3.5`
  - `kevinchina/deeplearning:fastgpt-code-sandbox-v4.14.10`

这意味着：

- 普通用户只部署博客主栈即可，不会因为 AI 被强制多拉一堆容器
- 需要 AI 的用户，再显式叠加 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml`
- FastGPT 备份标签已经单独留档完成；后续 VanBlog 常规发版默认不需要重新构建或重推这些 AI 依赖镜像，除非你主动决定升级 FastGPT 基线

## 2. 发布机制建议

建议把部署与发布分成四类来理解：

- **源码部署**：本地或调试环境直接使用 `docker-compose.yml`，从当前仓库源码构建并启动
- **latest 快速部署**：使用 `docker-compose.latest.yml`，直接拉取 `latest` 标签主栈
- **latest 一文件 + AI**：使用 `docker-compose.latest.ai.yml`，一次性拉起主栈和 bundled FastGPT
- **锁版镜像部署**：生产环境或分发场景使用 `docker-compose.image.yml`，直接拉取已经发布好的镜像

如果你的生产目录和当前这套线上目录一致，也可以长期只维护两份 quick-start 文件：

- `docker-compose.yaml`：你自己保存的 latest 主栈文件，不启用 AI
- `docker-compose.latest.ai.yml`：一份文件直接带 AI 工作台与 bundled FastGPT

这两份文件的定位是“生产机易维护入口”；仓库里保留 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml`，是为了锁版部署、测试和模块化排障。

推荐的正式发布流程：

1. 在 `master` 上整理代码并提交。
2. 运行完整测试，优先通过 `pnpm test:full`。
3. 确认根目录 `package.json` 的版本号正确，例如 `1.4.0`，并统一成发布标签 `vX.Y.Z`。
4. 先补齐本次版本对应的仓库文档：`docs/releases/vX.Y.Z.md`、GitHub Wiki、GitHub Release 草稿文案，写清楚本版特性、与上一公开稳定版的差异，以及可直接部署的 `docker compose` 配置单。
5. 给当前代码打版本 tag，并推送到 GitHub。
6. 使用 `scripts/release-images.sh` 构建并推送 5 个镜像。
7. 发布或更新 GitHub Release 页面，并确认 Wiki 页面、仓库 release 文档索引、GitHub Release 三处内容一致。
8. 记录本次版本号、Git tag、镜像 id（默认用 Git 短 SHA）、Wiki 地址、GitHub Release 地址。
9. 生产环境使用 `docker-compose.image.yml` 指向本次发布的镜像标签进行部署。

## 3. 镜像命名规范

镜像仓库默认使用：

```bash
kevinchina/deeplearning
```

每个服务发布 3 类 tag：

```bash
kevinchina/deeplearning:vanblog-<service>-<version>-<image-id>
kevinchina/deeplearning:vanblog-<service>-<version>
kevinchina/deeplearning:vanblog-<service>-latest
```

其中：

- `<service>`：固定为 `caddy`、`server`、`website`、`admin`、`waline`
- `<version>`：来自根目录 `package.json`，格式统一成 `vX.Y.Z`
- `<image-id>`：镜像唯一 id，默认使用 Git 短 SHA，例如 `git rev-parse --short=8 HEAD`

示例：

```bash
kevinchina/deeplearning:vanblog-caddy-v1.4.0-<image-id>
kevinchina/deeplearning:vanblog-server-v1.4.0-<image-id>
kevinchina/deeplearning:vanblog-website-v1.4.0-<image-id>
kevinchina/deeplearning:vanblog-admin-v1.4.0-<image-id>
kevinchina/deeplearning:vanblog-waline-v1.4.0-<image-id>
```

建议引用优先级：

- 对外文档 / Wiki / Release 示例：默认使用版本别名 tag，即 `vanblog-<service>-<version>`
- 需要严格锁定构建结果时：使用不可变 tag，即 `vanblog-<service>-<version>-<image-id>`
- 临时体验：可使用 `vanblog-<service>-latest`

## 4. 测试门槛

发布前建议按下面三层测试理解：

```bash
pnpm test:deploy
pnpm test:blog-flow
pnpm test:full
```

说明：

- `pnpm test:deploy`：适合改 compose、文档、路由、部署约束后快速检查；当前也会校验文档里关于 AI 工作台、FastGPT、镜像仓库、Cloudflare、latest / image 双轨说明是否齐全
- `pnpm test:blog-flow`：适合验证拆分服务的真实 compose 烟雾流转
- `pnpm test:full`：适合作为发版前默认门槛，覆盖单测、构建、部署检查与 compose 端到端流转

正式发版默认仍以 `pnpm test:full` 为准；如果只是对部署脚本或文档做较小调整，至少也应执行 `pnpm test:deploy`，涉及 compose 行为时再补 `pnpm test:blog-flow`。

## 5. 当前 AI / FastGPT 相关发布规则

关于后台 AI 问答依赖的 FastGPT，还有几个额外约定：

- `docker-compose.fastgpt.yml` 是可选运行时扩展，不属于默认公开拓扑
- `docker-compose.ai-qa.yml` 用于显式开启 `server -> FastGPT` 的连接，不应并入默认 compose
- 默认 `docker-compose.yml` / `docker-compose.image.yml` 不应因为 AI 问答而改变既有部署行为
- 如果发布说明涉及 AI 问答，必须明确写出它依赖私有 FastGPT 或 `docker-compose.ai-qa.yml` + `docker-compose.fastgpt.yml`
- `docker-compose.latest.ai.yml` 是 one-file quick-start；它内部也应继续引用 `kevinchina/deeplearning` 备份 FastGPT 标签，而不是直接依赖上游 GHCR
- `VAN_BLOG_FASTGPT_INTERNAL_URL` 只能指向私网 / 容器网络 / localhost 地址，不要通过 VanBlog 的 Caddy 暴露 FastGPT
- 如果要让 VanBlog admin 自动同步 bundled FastGPT 模型，宿主机还要提供 `FASTGPT_ROOT_PASSWORD`
- `docker-compose.fastgpt.yml` 里的一次性 `fastgpt-bootstrap` 会为旧 FastGPT 数据卷补齐缺失的 free plan / `team_subscriptions` 记录，避免创建 Dataset / App 时因 `currentSubLevel` 缺失而失败
- 如需调整这个 bootstrap 补齐出来的免费套餐额度或时长，使用 `FASTGPT_FREE_PLAN_POINTS` 与 `FASTGPT_FREE_PLAN_DURATION_DAYS`
- `docker/fastgpt/config.json` 与 `docker/fastgpt/config.json.example` 需要保持同步，便于部署端按模型供应商自行调整
- 后台 `/admin/ai` 的“配置中心”会让所有管理员填写完整 `.../chat/completions` 与 `.../embeddings` 地址、Token、模型名、调用 Key
- 如果同时提供了 `FASTGPT_ROOT_PASSWORD`，后台还可以直接“自动创建 Dataset / App / API Key”，不需要先去 FastGPT 手工录入资源 id
- AI 工作台当前入口是 `/admin/ai`，对所有管理员开放；旧入口只作为兼容跳转
- 当前回答策略是“博客知识优先 + 通用知识补充”，不再要求“无引用拒答”
- bundled FastGPT 的固定版本基线默认保持不变；只有在你主动决定升级 FastGPT 技术栈时，才重新联调并改 compose

## 6. 发布前准备

在执行正式发版前，请确认：

```bash
pnpm install
pnpm test:full
```

还需要确认下面几项：

- Docker 已登录目标仓库：`docker login`
- 当前分支代码已提交，避免从脏工作区发版
- 根目录 `package.json` 里的版本号已经更新
- 本次发布确实对应当前代码状态
- `gh auth status` 已登录，便于直接维护 GitHub Wiki 和 GitHub Release

查看当前版本：

```bash
node -p "require('./package.json').version"
```

查看当前提交短 SHA：

```bash
git rev-parse --short=8 HEAD
```

## 7. 手动发布

### 7.1 仅本地构建，不推送

```bash
pnpm release:images
```

等价于：

```bash
bash scripts/release-images.sh
```

默认行为：

- 自动读取 `package.json` 版本，例如 `1.4.0`，并规范成 `v1.4.0`
- 自动读取当前 Git 短 SHA 作为 `image-id`
- 自动执行 `pnpm test:blog-flow`
- 为 5 个服务构建镜像
- 生成 3 套 tag，但本地模式不会推送到远端仓库

### 7.2 正式推送发布

```bash
pnpm release:images:push
```

等价于：

```bash
bash scripts/release-images.sh --push
```

如果要显式指定版本号和镜像 id：

```bash
bash scripts/release-images.sh \
  --version v1.4.0 \
  --image-id <image-id> \
  --repo kevinchina/deeplearning \
  --push
```

正式推送时的约定：

- 要把不可变 tag、版本别名 tag、`latest` 三套 tag 都推送上去
- 但版本文档、Wiki、GitHub Release 中给用户展示的 compose 示例，默认写版本别名 tag，例如 `kevinchina/deeplearning:vanblog-caddy-v1.4.0`

### 7.3 常用参数

```bash
bash scripts/release-images.sh --help
```

常见参数：

- `--version <vX.Y.Z>`：手动指定发布版本
- `--image-id <id>`：手动指定镜像 id
- `--repo <repo>`：修改镜像仓库名
- `--platforms <list>`：用于 `buildx` 推送多架构镜像
- `--push`：构建后直接推送
- `--skip-tests`：跳过发布脚本内置的 `pnpm test:blog-flow`
- `--skip-builds`：跳过补充构建步骤，通常只在你明确已有最新产物时使用

## 8. 文档与版本说明要求

每个正式版本都应当有一份和版本号绑定的发布说明。无论它最终放在 GitHub Wiki、仓库文档站、`docs/releases/`，还是其他对外文档系统，都应满足下面要求。

最低要求：

- 文档标题必须与版本绑定，例如 `v1.4.0`
- 明确说明本版的核心特性、修复项、兼容性变化
- 说明它和“上一公开稳定版”的差异，而不是只写零散改动
- 给出可直接部署的 `docker compose` 配置单或等价的 `.env` + compose 说明
- 给出镜像标签示例、部署命令、升级命令、回滚命令
- 明确说明 AI 工作台是否可选、FastGPT 是否被固定版本、哪些 compose 文件需要叠加

本仓库当前至少维护三份版本发布说明，它们应保持同一版本口径：

- `docs/releases/vX.Y.Z.md`
- GitHub Wiki：`Release-vX.Y.Z`
- GitHub Release：`vX.Y.Z`

推荐顺序：

1. 先写仓库内 `docs/releases/vX.Y.Z.md`
2. 再以它为基础生成 Wiki 页面
3. 最后再整理一版较精简的 GitHub Release 文案

## 9. 部署配置单要求

每个正式版本的 Wiki / release note 都应带一份“别人拿过去就能改变量部署”的配置单。它可以是完整 `docker-compose.yaml` 示例，也可以是 `docker-compose.image.yml` + `.env` 的组合说明，但必须满足下面要求：

- 使用当前版本对应的不可变镜像 tag，格式为 `vanblog-<service>-vX.Y.Z-<image-id>`
- 与当前官方运行拓扑保持一致，默认应覆盖 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`
- 明确哪些目录需要持久化挂载
- 明确哪些环境变量必须改成用户自己的值
- 明确对外暴露端口，以及哪些端口不应暴露到公网
- 如果附带 AI 说明，要明确它是可选覆盖层，不要写成默认强依赖

配置单内容建议至少覆盖：

- 镜像 tag 示例
- `EMAIL`
- `POSTGRES_*`
- `VAN_BLOG_DATABASE_URL`
- `VAN_BLOG_REDIS_URL`
- `WALINE_JWT_TOKEN`
- `VAN_BLOG_WALINE_DATABASE_URL`
- `VANBLOG_RELEASE_SUFFIX` 或直接写死的版本镜像 tag
- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`
- `80/443` 或自定义宿主机 HTTP 端口映射
- `data/static`、`data/postgres`、`data/redis`、`caddy/config`、`caddy/data`、`log` 等挂载目录

Cloudflare 相关约定也要写清楚：

- 如果 `VAN_BLOG_CLOUDFLARE_API_TOKEN` 与 `VAN_BLOG_CLOUDFLARE_ZONE_ID` 都留空，Cloudflare tag/url purge 不会启用
- Cloudflare URL purge 还依赖 `siteInfo.baseUrl`
- 如果 `siteInfo.baseUrl` 缺失或不是最终公网地址，Cloudflare URL purge 会被跳过

## 10. 使用已发布镜像部署

### 10.0 生产目录双文件 quick-start

如果你线上机器追求“目录里文件尽量少、平时好维护”，可以像当前生产目录一样，只保留：

- `docker-compose.yaml`：不带 AI 的主栈
- `docker-compose.latest.ai.yml`：带 AI 的 one-file 主栈

对应使用方式：

```bash
# 主栈
docker compose pull
docker compose up -d

# AI 主栈
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

这里要注意：

- `docker-compose.yaml` 是你生产机本地保留的 quick-start 主文件，通常内容等价于仓库里的 `docker-compose.latest.yml`
- `docker-compose.latest.ai.yml` 会额外拉起 bundled FastGPT，并使用上面已经备份到 `kevinchina/deeplearning` 的 4 个固定 FastGPT 标签
- 这种方案适合长期个人维护，但它本质仍然是 `latest` 路线，不适合精确锁版审计
- 真正需要“某个版本精确回滚”的发布，仍然优先使用 `docker-compose.image.yml` + `.env`

生产部署推荐使用根目录的：

```bash
docker-compose.image.yml
```

这个文件不会从源码构建，而是直接拉取已经发布的镜像。

### 10.1 直接部署某次固定发布

```bash
export VANBLOG_DOCKER_REPO=kevinchina/deeplearning
export VANBLOG_RELEASE_SUFFIX=v1.4.0-<image-id>

docker compose -f docker-compose.image.yml up -d
```

此时各服务会自动解析为：

- `vanblog-caddy-v1.4.0-<image-id>`
- `vanblog-server-v1.4.0-<image-id>`
- `vanblog-website-v1.4.0-<image-id>`
- `vanblog-admin-v1.4.0-<image-id>`
- `vanblog-waline-v1.4.0-<image-id>`

如果这次发布包含 Cloudflare 缓存契约或定向 purge 相关改动，部署前还应确认服务器 `.env` 中是否已经保留：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

如果两者留空，镜像仍可运行，但文章更新后的 Cloudflare tag/url purge 不会启用。

还应确认线上站点元数据中的 `siteInfo.baseUrl` 已经设置成最终公网地址；如果这个值缺失，tag purge 仍可发送，但 Cloudflare URL purge 会被跳过。

如果这次发布涉及评论系统，也应确认服务器 `.env` 中已经包含或知晓下面这些值：

- `VAN_BLOG_WALINE_DATABASE_URL`
- `WALINE_JWT_TOKEN`

当前官方拓扑默认让 `server` 通过 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361` 管理独立 Waline 容器，并让 Waline 使用同一个 PostgreSQL 实例里的独立 `waline` 数据库。如果 `WALINE_JWT_TOKEN` 留空，当前镜像会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启继续复用。

### 10.2 使用版本别名或 latest

如果你想改成别名模式，可以直接调整 `VANBLOG_RELEASE_SUFFIX`：

```bash
export VANBLOG_RELEASE_SUFFIX=v1.4.0
```

如果你坚持使用 latest：

```bash
export VANBLOG_RELEASE_SUFFIX=latest
```

但仍然建议生产环境优先使用不可变 tag，而不是 `latest`。

## 11. 回滚建议

如果线上有问题，直接把 `VANBLOG_RELEASE_SUFFIX` 改回上一版即可：

```bash
export VANBLOG_RELEASE_SUFFIX=v0.53.0-a1b2c3d4
docker compose -f docker-compose.image.yml up -d
```

如果只是 AI 功能本身有问题，也可以先移除 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml`，把博客主栈继续保留在线。

## 12. AI 代理发版规则

如果 AI 需要帮你发版，默认应遵守下面规则：

1. 优先阅读本文件和 `README.md`。
2. 默认以 `master` 当前代码为基准，不要猜测其他分支。
3. 版本号默认读取根目录 `package.json`。
4. 镜像 id 默认读取 `git rev-parse --short=8 HEAD`。
5. 发版命令默认使用：

```bash
bash scripts/release-images.sh --push
```

6. 部署到服务器时默认使用：

```bash
docker compose -f docker-compose.image.yml up -d
```

7. 不要把 `postgres`、`redis` 端口暴露到 `0.0.0.0`。
8. 不要把 Caddy admin API `2019` 暴露到宿主机。
9. 任何涉及 `/admin` 的改动都要考虑子路径资源和跳转。
10. 发版前优先跑：

```bash
pnpm test:full
```

11. 除了镜像发布外，还要同步维护当前版本的 Wiki / release note，并确保其中的 compose 配置单与当前版本一致。
12. 如果使用 GitHub Wiki，默认通过 `gh repo clone <owner>/<repo>.wiki` 拉取并提交，不要在浏览器里手工改完后忘记同步本地文档。
13. 如果创建 GitHub Release，优先使用 `gh release create` 或 `gh release edit`，并确保 Release 文案中的镜像 tag、Wiki 链接、版本说明链接都已更新。

## 13. GitHub Actions 说明

当前仓库不再使用 GitHub Actions 执行正式镜像发布、测试环境推送、ARM 测试镜像推送或文档镜像部署。

原因很直接：

- Docker Hub 发布以当前机器的本地手工流程为准
- 本机已经配置了代理、buildx builder、测试链路和 Docker 登录态
- 推送 `master` 或 `v*` tag 后再让 GitHub 侧重复构建 / 部署，容易产生失败邮件和额外噪音
- 版本发布要以“本机测试通过 + 本机构建镜像 + 本机推送”为唯一准入路径

因此：

- 正式发布统一使用本地命令：`pnpm release:images:push`
- 当前仅保留 PR 级别的普通代码校验；向 GitHub 推送版本 tag 不应再触发远端镜像发布流程

## 14. 常用命令速查

```bash
# 查看版本
node -p "require('./package.json').version"

# 查看 commit 短 SHA
git rev-parse --short=8 HEAD

# 部署约束 / 文档检查
pnpm test:deploy

# compose 烟雾流转
pnpm test:blog-flow

# 发版前完整回归
pnpm test:full

# 本地构建镜像
pnpm release:images

# 构建并推送镜像
pnpm release:images:push

# 用发布镜像部署
VANBLOG_DOCKER_REPO=kevinchina/deeplearning \
VANBLOG_RELEASE_SUFFIX=v1.4.0-<image-id> \
docker compose -f docker-compose.image.yml up -d
```
