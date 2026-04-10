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
2. 运行完整测试，至少通过 `pnpm test:blog-flow`。
3. 确认根目录 `package.json` 的版本号正确，例如 `1.0.0`。
4. 使用 `scripts/release-images.sh` 构建并推送 5 个镜像。
5. 记录本次版本号和镜像 id（默认用 Git 短 SHA）。
6. 生产环境使用 `docker-compose.image.yml` 指向本次发布的镜像标签进行部署。

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
pnpm test:blog-flow
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
- `--skip-tests`：跳过 `pnpm test:blog-flow`
- `--skip-builds`：跳过补充构建步骤，通常只在你明确已有最新产物时使用

### 5.4 推荐的人工发版顺序

```bash
# 1) 确认工作区状态
git status

# 2) 跑完整测试
pnpm test:blog-flow

# 3) 看一下版本号
node -p "require('./package.json').version"

# 4) 登录镜像仓库
docker login

# 5) 发布 5 个镜像
pnpm release:images:push
```

## 6. 使用已发布镜像部署

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

## 7. 回滚建议

如果线上有问题，直接把 `VANBLOG_RELEASE_SUFFIX` 改回上一版即可：

```bash
export VANBLOG_RELEASE_SUFFIX=v0.53.0-a1b2c3d4
docker compose -f docker-compose.image.yml up -d
```

这也是拆分多镜像加版本化标签的核心价值：**可快速回滚，可精确定位。**

## 8. AI 代理发版规则

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
pnpm test:blog-flow
```

## 9. GitHub Actions 建议

仓库已经保留了基于这个机制的 Actions 样例：

- `.github/workflows/release.yml`：推送 `v*` tag 时自动构建并发布多镜像
- `.github/workflows/local-build.yml`：手动触发构建/推送

建议做法：

- 开发期先用本地手工发布验证流程
- 稳定后再主要依赖 GitHub Actions 自动化
- 无论本地还是 CI，镜像命名都必须遵循同一套 tag 规范

## 10. 常用命令速查

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
