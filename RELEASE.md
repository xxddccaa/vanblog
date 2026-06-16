# 发布指南

这份文档同时面向人工维护者和 AI 代理。

目标有三个：

- 统一本仓库的构建、打包、发版与部署方式
- 明确多镜像发布规范，避免再回到单镜像 `kevinchina/deeplearning:vanblog-latest` 的不可追踪模式
- 保留一个可选的 all-in-one 单镜像发布入口，方便只维护一个 VanBlog 容器

当前代码基线已经推进到 `v1.6.6`，默认镜像仓库继续固定为长期保留的 `kevinchina/deeplearning`。

## 1. 发布边界

先明确当前仓库的发布边界：

- VanBlog 核心发布物是 5 个镜像：`caddy`、`server`、`website`、`admin`、`waline`
- 数据库和缓存继续使用运行时官方镜像：`postgres:16-alpine`、`redis:7-alpine`
- `vanblog-all-in-one` 是**必发**发布物：它把主栈和 `postgres` / `redis` 收进同一个容器，每次发版都必须随 5 个核心镜像一起发布并同步 `latest`
- `pnpm release:images` / `pnpm release:images:push` 只负责 5 个核心镜像
- `pnpm release:publish` 只负责发布 5 个核心镜像，不会发布 `vanblog-all-in-one-latest`
- `pnpm release:all-in-one` / `pnpm release:all-in-one:push` / `pnpm release:all-in-one:publish` 只发布 `vanblog-all-in-one-*` 单镜像标签

## 2. 发布机制建议

建议把部署与发布分成四类来理解：

- **源码部署**：本地或调试环境直接使用 `docker-compose.yml`
- **latest 快速部署**：使用 `docker-compose.latest.yml`
- **latest 单镜像**：使用 `docker-compose.all-in-one.latest.yml`
- **锁版镜像部署**：生产环境或分发场景使用 `docker-compose.image.yml`
- **锁版单镜像**：使用 `docker-compose.all-in-one.image.yml`

推荐的正式发布流程：

1. 在 `master` 上整理代码并提交。
2. 运行完整测试，优先通过 `pnpm test:full`。
3. 确认根目录 `package.json` 的版本号正确，例如 `1.6.2`，并统一成发布标签 `vX.Y.Z`。
4. 补齐本次版本对应的仓库文档：`docs/releases/vX.Y.Z.md`、GitHub Wiki、GitHub Release 草稿文案。
5. 给当前代码打版本 tag，并推送到 GitHub。
6. 先执行 `pnpm release:publish` 发布 5 个核心镜像。
7. **必做**：紧接着执行 `pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id>`，发布 `vanblog-all-in-one-*` 并把 `kevinchina/deeplearning:vanblog-all-in-one-latest` 同步到同一版本。all-in-one 每次发版都要发，不再是可选步骤。
8. 确认 Wiki 页面、仓库 release 文档索引、GitHub Release 三处内容一致。
9. 记录本次版本号、Git tag、镜像 id、5 个核心镜像发布结果，以及 all-in-one（版本标签 + latest）发布结果。
10. 生产环境使用 `docker-compose.image.yml` 指向本次发布的镜像标签进行部署；单镜像部署使用 `docker-compose.all-in-one.image.yml` 或已经同步的 `docker-compose.all-in-one.latest.yml`。

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

## 4. 测试门槛

发布前建议按下面三层测试理解：

```bash
pnpm test:deploy
pnpm test:blog-flow
pnpm test:full
```

说明：

- `pnpm test:deploy`：适合改 compose、文档、路由、部署约束后快速检查
- `pnpm test:blog-flow`：适合验证拆分服务的真实 compose 烟雾流转
- `pnpm test:full`：适合作为发版前默认门槛，覆盖单测、构建、部署检查与 compose 端到端流转

## 5. 发布前准备

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

## 6. 手动发布

### 6.1 仅本地构建，不推送

```bash
pnpm release:images
```

等价于：

```bash
bash scripts/release-images.sh
```

默认行为：

- 自动读取 `package.json` 版本，例如 `1.6.2`，并规范成 `v1.6.2`
- 自动读取当前 Git 短 SHA 作为 `image-id`
- 自动执行 `pnpm test:blog-flow`
- 为 5 个服务构建镜像

### 6.2 正式推送发布

```bash
pnpm release:publish
```

等价于：

```bash
bash scripts/release-publish.sh
```

如果要显式指定版本号和镜像 id：

```bash
bash scripts/release-publish.sh \
  --version v1.6.2 \
  --image-id <image-id> \
  --repo kevinchina/deeplearning
```

### 6.3 底层镜像脚本

```bash
pnpm release:images:push
```

等价于：

```bash
bash scripts/release-images.sh --push
```

### 6.4 all-in-one 发布（每次发版必做）

`pnpm release:publish` 不会发布 all-in-one，因此每次发版都必须单独执行一次 all-in-one 发布流程，把版本标签与 `kevinchina/deeplearning:vanblog-all-in-one-latest` 一起同步。

```bash
pnpm release:all-in-one
pnpm release:all-in-one:push
pnpm release:all-in-one:publish
pnpm release:all-in-one:latest --version vX.Y.Z --image-id <id>
```

正式发版在 5 个核心镜像发布成功后，紧接着执行：

```bash
pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id>
```

该命令会发布并验证：

```bash
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z-<image-id>
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z
kevinchina/deeplearning:vanblog-all-in-one-latest
```
