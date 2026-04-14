# 发布指南

这份文档同时面向 **人工维护者** 和 **AI 代理**。

目标有两个：

- 统一本仓库的构建、打包、发版与部署方式。
- 明确多镜像发布规范，避免再回到单镜像 `kevinchina/deeplearning:vanblog-latest` 的不可追踪模式。

## 1. 发布机制建议

建议把发布分成两类：

- **源码部署**：本地或调试环境直接使用 `docker-compose.yml`，从当前仓库源码构建并启动。
- **镜像部署**：生产环境或分发场景使用 `docker-compose.image.yml`，直接拉取已经发布好的镜像。

推荐的正式发布流程：

1. 在 `master` 上整理代码并提交。
2. 运行完整测试，优先通过 `pnpm test:full`。
3. 确认根目录 `package.json` 的版本号正确，例如 `1.0.0`，并统一成发布标签 `vX.Y.Z`。
4. 先补齐本次版本对应的 wiki / release note，写清楚本版特性、与上一公开稳定版的差异，以及可直接部署的 `docker compose` 配置单。
5. 给当前代码打版本 tag，并推送到 GitHub。
6. 使用 `scripts/release-images.sh` 构建并推送 5 个镜像。
7. 记录本次版本号、Git tag、镜像 id（默认用 Git 短 SHA）和对应 wiki / release note 地址。
8. 生产环境使用 `docker-compose.image.yml` 指向本次发布的镜像标签进行部署。

这个机制的优点：

- 每个服务单独发布，问题定位更快。
- 每个镜像都带有 **服务名 + 版本 + 镜像 id**，可追溯到具体代码。
- 支持 `latest`、版本别名、不可变标签三套引用方式。
- AI 可以直接按文档执行，不需要猜测镜像命名规则。

## 2. 镜像命名规范

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

- `<service>`：服务名，固定为 `caddy`、`server`、`website`、`admin`、`waline`
- `<version>`：来自根目录 `package.json`，格式建议统一成 `vX.Y.Z`
- `<image-id>`：镜像唯一 id，默认使用 Git 短 SHA，例如 `git rev-parse --short=8 HEAD` 的结果

示例：

```bash
kevinchina/deeplearning:vanblog-caddy-v1.0.0-<image-id>
kevinchina/deeplearning:vanblog-server-v1.0.0-<image-id>
kevinchina/deeplearning:vanblog-website-v1.0.0-<image-id>
kevinchina/deeplearning:vanblog-admin-v1.0.0-<image-id>
kevinchina/deeplearning:vanblog-waline-v1.0.0-<image-id>
```

建议引用优先级：

- **生产环境**：优先使用不可变 tag，即 `vanblog-<service>-<version>-<image-id>`
- **人工查看**：可使用 `vanblog-<service>-<version>`
- **临时体验**：可使用 `vanblog-<service>-latest`

## 3. 当前镜像清单

本仓库当前拆分为以下镜像：

| 服务 | Dockerfile | 说明 |
| --- | --- | --- |
| `caddy` | `docker/caddy.Dockerfile` | 对外网关，统一处理 `/`、`/admin`、`/api`、评论等路由 |
| `server` | `docker/server.Dockerfile` | NestJS 后端 API、静态资源、Swagger |
| `website` | `docker/website.Dockerfile` | Next.js 前台站点 |
| `admin` | `docker/admin.Dockerfile` | Umi 后台静态页面 |
| `waline` | `docker/waline.Dockerfile` | 评论服务 |

数据库与缓存继续直接使用官方镜像：

- `postgres:16-alpine`
- `redis:7-alpine`

它们属于运行时依赖，不单独维护自定义发布镜像。

## 4. 发布前准备

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

查看当前版本：

```bash
node -p "require('./package.json').version"
```

查看当前提交短 SHA：

```bash
git rev-parse --short=8 HEAD
```

## 5. 手动发布

### 5.1 仅本地构建，不推送

适合先检查镜像是否能正常构建。

```bash
pnpm release:images
```

等价于：

```bash
bash scripts/release-images.sh
```

默认行为：

- 自动读取 `package.json` 版本，例如 `1.0.0`，并规范成 `v1.0.0`
- 自动读取当前 Git 短 SHA 作为 `image-id`
- 自动执行 `pnpm test:blog-flow`
- 为 5 个服务构建镜像
- 生成 3 套 tag，但本地模式不会推送到远端仓库

### 5.2 正式推送发布

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
  --version v1.0.0 \
  --image-id <image-id> \
  --repo kevinchina/deeplearning \
  --push
```

### 5.3 常用参数

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

### 5.4 推荐的人工发版顺序

```bash
# 1) 确认工作区状态
git status

# 2) 跑完整测试
pnpm test:full

# 3) 看一下版本号
node -p "require('./package.json').version"

# 4) 先更新本次版本对应的 wiki / release note
#    - 写本版特性
#    - 写和上一公开稳定版的区别
#    - 写 docker compose 配置单

# 5) 推 Git 提交
git push origin master

# 6) 打版本 tag（示例）
git tag v1.0.0
git push origin v1.0.0

# 7) 登录镜像仓库
docker login

# 8) 发布 5 个镜像
pnpm release:images:push
```

## 6. 版本 wiki / release note 要求

每个正式版本都应当有一份和版本号绑定的发布说明。无论它最终放在 GitHub Wiki、仓库文档站、`docs/releases/`，还是其他对外文档系统，都应满足下面要求。

最低要求：

- 文档标题必须与版本绑定，例如 `v1.3.2`
- 明确说明本版的核心特性、修复项、兼容性变化
- 说明它和“上一公开稳定版”的差异，而不是只写零散改动
- 给出可直接部署的 `docker compose` 配置单或等价的 `.env` + compose 说明
- 给出镜像标签示例、部署命令、升级命令、回滚命令

关于“和上一版的差异”：

- 默认对比“上一公开稳定版”或“上一里程碑版本”
- 例如当前发布 `v1.3.2`，如果对外实际承接的是 `v1.3.0`，那 wiki 应明确写出 `v1.3.2` 相比 `v1.3.0` 的新增、修复和部署差异
- 不要假定读者会自己翻 commit 或自己比较多个历史版本

建议结构：

```md
# vX.Y.Z

## 本版摘要

## 相比上一公开稳定版的变化

## 主要特性 / 修复

## 部署前注意事项

## docker compose 配置单

## 升级步骤

## 回滚方法
```

## 7. docker compose 配置单要求

每个正式版本的 wiki / release note 都应带一份“别人拿过去就能改变量部署”的配置单。它可以是完整 `docker-compose.yaml` 示例，也可以是 `docker-compose.image.yml` + `.env` 的组合说明，但必须满足下面要求：

- 使用当前版本对应的不可变镜像 tag，格式为 `vanblog-<service>-vX.Y.Z-<image-id>`
- 与当前官方运行拓扑保持一致，默认应覆盖 `caddy`、`server`、`website`、`admin`、`waline`、`postgres`、`redis`
- 明确哪些目录需要持久化挂载
- 明确哪些环境变量必须改成用户自己的值
- 明确对外暴露端口，以及哪些端口不应暴露到公网

配置单内容建议至少覆盖：

- 镜像 tag 示例
- `EMAIL`
- `POSTGRES_*`
- `VAN_BLOG_DATABASE_URL`
- `VAN_BLOG_REDIS_URL`
- `WALINE_JWT_TOKEN`
- `VAN_BLOG_WALINE_DATABASE_URL`
- `VANBLOG_RELEASE_SUFFIX` 或直接写死的版本镜像 tag
- `80/443` 或自定义宿主机 HTTP 端口映射
- `data/static`、`data/postgres`、`data/redis`、`caddy/config`、`caddy/data`、`log` 等挂载目录

如果 wiki 里提供的是“最小 compose 示例”，请额外标注一句：

- 示例的字段、服务清单和环境变量以仓库当前 `docker-compose.image.yml` 与 `.env.release.example` 为准，后续版本发布时要同步更新，不要直接复制旧版本的配置单。

## 8. 使用已发布镜像部署

生产部署推荐使用根目录的：

```bash
docker-compose.image.yml
```

这个文件不会从源码构建，而是直接拉取已经发布的镜像。

### 6.1 直接部署某次固定发布

```bash
export VANBLOG_DOCKER_REPO=kevinchina/deeplearning
export VANBLOG_RELEASE_SUFFIX=v1.0.0-<image-id>

docker compose -f docker-compose.image.yml up -d
```

此时各服务会自动解析为：

- `vanblog-caddy-v1.0.0-<image-id>`
- `vanblog-server-v1.0.0-<image-id>`
- `vanblog-website-v1.0.0-<image-id>`
- `vanblog-admin-v1.0.0-<image-id>`
- `vanblog-waline-v1.0.0-<image-id>`

如果这次发布包含 Cloudflare 缓存契约或定向 purge 相关改动，部署前还应确认服务器 `.env` 中是否已经保留：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

如果两者留空，镜像仍可运行，但文章更新后的 Cloudflare tag/url purge 不会启用。

还应确认线上站点元数据中的 `siteInfo.baseUrl` 已经设置成最终公网地址；如果这个值缺失，tag purge 仍可发送，但 Cloudflare URL purge 会被跳过。

如果这次发布涉及评论系统，也应确认服务器 `.env` 中已经设置：

- `VAN_BLOG_WALINE_DATABASE_URL`
- `WALINE_JWT_TOKEN`

当前官方拓扑默认让 `server` 通过 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361` 管理独立 Waline 容器，并让 Waline 使用同一个 PostgreSQL 实例里的独立 `waline` 数据库。
缺失 `WALINE_JWT_TOKEN` 时，Waline 相关容器会拒绝启动，避免生产环境回退到弱默认密钥。

### 6.2 使用版本别名或 latest

如果你想改成别名模式，可以直接调整 `VANBLOG_RELEASE_SUFFIX`：

```bash
export VANBLOG_RELEASE_SUFFIX=v1.0.0
```

如果你坚持使用 latest：

```bash
export VANBLOG_RELEASE_SUFFIX=latest
```

但仍然建议生产环境优先使用不可变 tag，而不是 `latest`。

## 9. 回滚建议

如果线上有问题，直接把 `VANBLOG_RELEASE_SUFFIX` 改回上一版即可：

```bash
export VANBLOG_RELEASE_SUFFIX=v0.53.0-a1b2c3d4
docker compose -f docker-compose.image.yml up -d
```

这也是拆分多镜像加版本化标签的核心价值：**可快速回滚，可精确定位。**

## 10. AI 代理发版规则

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

11. 除了镜像发布外，还要同步维护当前版本的 wiki / release note，并确保其中的 compose 配置单与当前版本一致。

## 11. GitHub Actions 说明

当前仓库**不再使用 GitHub Actions 执行正式镜像发布、测试环境推送、ARM 测试镜像推送或文档镜像部署**。

原因很直接：

- Docker Hub 发布以当前机器的本地手工流程为准
- 本机已经配置了代理、buildx builder、测试链路和 Docker 登录态
- 推送 `master` 或 `v*` tag 后再让 GitHub 侧重复构建/部署，容易产生失败邮件和额外噪音
- 版本发布要以“本机测试通过 + 本机构建镜像 + 本机推送”为唯一准入路径

因此：

- `.github/workflows/deploy-docs.yml` 已移除
- `.github/workflows/test.yml` 已移除
- `.github/workflows/test-arm.yml` 已移除
- 正式发布统一使用本地命令：`pnpm release:images:push`
- 当前仅保留 PR 级别的普通代码校验；向 GitHub 推送版本 tag 不应再触发远端镜像发布流程

如果保留 GitHub Actions，定位仅限于普通代码校验；不要再把 Docker Hub 正式发布绑定到 GitHub Actions。

## 12. 常用命令速查

```bash
# 查看版本
node -p "require('./package.json').version"

# 查看 commit 短 SHA
git rev-parse --short=8 HEAD

# 本地构建镜像
pnpm release:images

# 构建并推送镜像
pnpm release:images:push

# 查看帮助
pnpm release:images:help

# 用发布镜像部署
VANBLOG_DOCKER_REPO=kevinchina/deeplearning \
VANBLOG_RELEASE_SUFFIX=v1.0.0-<image-id> \
docker compose -f docker-compose.image.yml up -d
```
