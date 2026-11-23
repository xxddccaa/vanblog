# 发布指南

这份文档同时面向人工维护者和 AI 代理。

目标有三个：

- 统一本仓库的构建、打包、发版与部署方式
- 明确多镜像发布规范，避免再回到单镜像 `kevinchina/deeplearning:vanblog-latest` 的不可追踪模式
- 保留一个可选的 all-in-one 单镜像发布入口，方便只维护一个 VanBlog 容器

当前代码基线已经推进到 `v2.1.1`，默认镜像仓库继续固定为长期保留的 `kevinchina/deeplearning`。

## 1. 发布边界

先明确当前仓库的发布边界：

- VanBlog 核心发布物是 4 个镜像：`caddy`、`server`、`website`、`admin`（评论已内置到 `server`，不再发布 `waline` 镜像）
- 数据库和缓存继续使用运行时官方镜像：`postgres:16-alpine`、`redis:7-alpine`
- `vanblog-all-in-one` 是**必发**发布物：它把主栈和 `postgres` / `redis` 收进同一个容器，每次发版都必须随 4 个核心镜像一起发布并同步 `latest`
- `pnpm release:images` / `pnpm release:images:push` 只负责 4 个核心镜像
- `pnpm release:publish` 只负责发布 4 个核心镜像，不会发布 `vanblog-all-in-one-latest`
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
6. 先执行 `pnpm release:publish` 发布 4 个核心镜像。
7. **必做**：紧接着执行 `pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id>`，发布 `vanblog-all-in-one-*` 并把 `kevinchina/deeplearning:vanblog-all-in-one-latest` 同步到同一版本。all-in-one 每次发版都要发，不再是可选步骤。
8. 确认 Wiki 页面、仓库 release 文档索引、GitHub Release 三处内容一致。
9. 记录本次版本号、Git tag、镜像 id、4 个核心镜像发布结果，以及 all-in-one（版本标签 + latest）发布结果。
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

- `<service>`：固定为 `caddy`、`server`、`website`、`admin`
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
- 为 4 个服务构建镜像

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

正式发版在 4 个核心镜像发布成功后，紧接着执行：

```bash
pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id>
```

该命令会发布并验证：

```bash
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z-<image-id>
kevinchina/deeplearning:vanblog-all-in-one-vX.Y.Z
kevinchina/deeplearning:vanblog-all-in-one-latest
```

## 7. Docker 代理与构建容器

如果本机 Docker CLI 需要通过宿主机代理访问 Docker Hub，但 `~/.docker/config.json`
中的 `127.0.0.1` 代理被自动传进 BuildKit 构建容器，容器内的 `pnpm` / `apk`
会把这个地址解释成容器自身并连接失败。

本机发布**优先用 7.0 的宿主机代理**；代理不可用时，才保留 Docker CLI 的代理与登录配置，同时设置：

```bash
CLEAR_BUILD_PROXIES=true pnpm release:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
CLEAR_BUILD_PROXIES=true pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
```

该变量只清空镜像构建阶段的标准代理 build args，不修改宿主机 Docker daemon、
Docker Hub 登录凭据或全局代理配置。

### 7.0 推荐：构建走宿主机代理（本机首选）

本机 `127.0.0.1:10826` 上运行着 sing-box 代理。构建直接走它，比 Alpine 国内镜像源快，也更稳定。
`2026-11-18` 发布 `v2.0.0` 时实测：all-in-one 运行层要装的 `caddy`、`postgresql16` 等大包，
经代理从官方源下载约 22 秒；同一天用清华源，第一次在这一步挂住 29 分钟，重跑才成功。

```bash
BUILD_PROXY=http://127.0.0.1:10826 pnpm release:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
BUILD_PROXY=http://127.0.0.1:10826 pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
```

说明：

- 设置 `BUILD_PROXY` 后，发布脚本会给构建命令加上 `--network host`，并把代理作为构建参数传进去。
  必须用主机网络，是因为 sing-box 只监听 `127.0.0.1`：普通构建容器里的 `127.0.0.1` 是容器自己，
  经 Docker 网桥 `172.17.0.1` 也连不上。
- 主机网络下，构建容器能访问宿主机的所有端口。all-in-one 镜像构建前台时，已固定把服务端地址指向
  不可达的 `127.0.0.1:1`，不会误连宿主机 `3000` 端口上的其他服务。发布 `v2.1.0` 时还没有这一处理，
  all-in-one 在 `/tag/[tag]` 页构建失败，最后改用镜像源方案发布。
- 走代理时直接用官方 Alpine 源，不需要再设 `ALPINE_MIRROR_HOST`。`BUILD_PROXY` 不能和
  `CLEAR_BUILD_PROXIES=true` 同时使用，脚本会直接报错退出。
- 发布前先确认代理可用，返回 `401` 就是正常的（Docker Hub 要求登录）：

  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -x http://127.0.0.1:10826 https://registry-1.docker.io/v2/
  ```

- 代理连不上（返回 `000` 或超时）时，先在 sing-box 客户端里恢复代理；确实恢复不了，再退回下面 7.1 的镜像源方案。

### 7.1 Alpine 源选择

`2026-09-01` 发布 `v1.8.5` 时，all-in-one 构建使用官方
`dl-cdn.alpinelinux.org`，运行时 `apk add` 在安装 Caddy 后持续超过 15 分钟
没有继续推进。确认构建容器仍连接官方 CDN、并排除 BuildKit 死锁后，中止该次
构建并改用 `mirrors.aliyun.com`；同一运行时系统包层约 48 秒完成，随后镜像
成功发布并通过标签校验。

在这台发布机器上，正式发布建议直接同时设置 Alpine 镜像源和构建代理开关：

```bash
ALPINE_MIRROR_HOST=mirrors.aliyun.com \
CLEAR_BUILD_PROXIES=true \
pnpm release:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds

ALPINE_MIRROR_HOST=mirrors.aliyun.com \
CLEAR_BUILD_PROXIES=true \
pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
```

`2026-11-17` 发布 `v1.9.1` 时，`mirrors.aliyun.com` 能装 `bash` 这类小包，
但 all-in-one 运行层安装 `caddy`、`postgresql16` 时持续挂住超过 1 小时；同一时刻
`mirrors.tuna.tsinghua.edu.cn` 与 `mirrors.ustc.edu.cn` 都能正常完成。换成清华源后
重跑即成功。镜像源的可用性会变，7.3 的预检要用**实际要装的大包**测，不要只测 `bash`。

`ALPINE_MIRROR_HOST` 会传给使用 Alpine 包管理器的拆分镜像和 all-in-one 镜像，
仅替换镜像构建阶段的 Alpine 仓库主机，不影响 Docker Hub 推送目标。若发布机器
不在中国大陆或该镜像不可达，应改成当前网络可稳定访问的 Alpine 镜像；不要为了
恢复 `apk` 下载而重新向构建容器注入宿主机 `127.0.0.1` 代理。

### 7.2 每个 `apk add` 构建阶段都必须接入镜像源

`CLEAR_BUILD_PROXIES=true` 之后，构建容器里**没有任何代理**。在这台发布机器上，
无代理直连 `dl-cdn.alpinelinux.org` 时 `apk add` 不报错、也不推进，会一直挂住。
因此 `ALPINE_MIRROR_HOST` 只有在**每一个**执行 `apk add` 的构建阶段都生效时才有用；
漏掉任何一个阶段，发版就会卡在那一层。

`2026-11-16` 发布 `v1.9.0` 时，`docker/server.Dockerfile` 的 `runner` 阶段
（自 `v1.8.0` 起）没有替换 Alpine 源，`server` 镜像在 `[runner 3/8] RUN apk add`
停留约 1 小时后被取消。同一机器上复测：

| 构建容器网络条件 | `apk add` 结果 |
| --- | --- |
| 无代理 + 官方 `dl-cdn` | 45 秒内无任何输出，被超时终止 |
| 无代理 + `mirrors.aliyun.com` | 约 8 秒完成 |
| 代理 `172.17.0.1:10826` + 官方 `dl-cdn` | 约 5 秒完成 |

修复后约定：

- 在 `docker/*.Dockerfile` 里新增或修改含 `apk add` 的阶段时，阶段内必须声明
  `ARG ALPINE_MIRROR_HOST=""`，并在同一条 `RUN` 开头先执行：
  `if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi`
- `tests/deployment-config.test.mjs` 会逐个阶段检查这条约定，`pnpm test:deploy`
  会在发版前拦下遗漏的阶段。
- `scripts/release-images.sh` 只给 `server`、`website` 传
  `ALPINE_MIRROR_HOST`；如果 `caddy` 或 `admin` 将来也需要 `apk add`，要同步扩展脚本里的服务列表。

### 7.3 构建卡住时的判断与处理

现象：发布日志停在某个 `RUN apk add ...` 步骤，超过 3 分钟没有新输出，也没有
`DONE` 或 `ERROR`。正常情况下这一步应在 1 分钟内完成。

先确认是不是 Alpine 源的问题（只读、不影响发布）：

```bash
# 模拟发版时的无代理构建容器：rc=143 表示官方源挂住，rc=0 表示正常
docker run --rm -e http_proxy= -e https_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= \
  node:22.22.2-alpine sh -c 'timeout 45 apk add --no-cache bash >/dev/null 2>&1; echo rc=$?'

# 同样条件换成镜像源，应返回 rc=0；用 all-in-one 真正要装的大包来测
docker run --rm -e http_proxy= -e https_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= \
  node:22.22.2-alpine sh -c 'sed -i s/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g /etc/apk/repositories; timeout 60 apk add --no-cache caddy postgresql16 >/dev/null 2>&1; echo rc=$?'
```

若某个镜像源返回 `rc=143`，换成 `mirrors.tuna.tsinghua.edu.cn` 或 `mirrors.ustc.edu.cn`
再测，用返回 `rc=0` 的那个作为 `ALPINE_MIRROR_HOST`。

### 7.5 工作区有未提交改动时发布 all-in-one

all-in-one 在镜像内从源码重新编译，构建上下文就是仓库目录（`COPY . ./`），
工作区里任何未提交的改动都会被打进镜像。发布时若工作区不干净（例如有人正在开发新功能），
不要 stash 或回退别人的改动，改为在独立 worktree 里发布：

```bash
git worktree add --detach /tmp/vanblog-release/wt-vX.Y.Z vX.Y.Z
cd /tmp/vanblog-release/wt-vX.Y.Z
BUILD_PROXY=http://127.0.0.1:10826 \
  bash scripts/release-all-in-one-publish.sh --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds
# 发布完成后清理
git -C <仓库目录> worktree remove /tmp/vanblog-release/wt-vX.Y.Z
```

确认后：中止当前发布进程，在日志里找出卡住的 Dockerfile 阶段，按 7.2 补上镜像源，
跑 `pnpm test:deploy`，再从头重跑发布命令。已经推送成功的镜像会被同名标签覆盖，不影响结果。
不要靠无限等待或重试来“碰运气”。

### 7.4 在后台运行发布命令

4 个核心镜像加 all-in-one 通常需要几十分钟。发布命令必须脱离当前终端或 AI 会话运行，
日志写入文件，这样会话中断时构建不会被一起杀掉，之后也能从日志接着判断进度：

```bash
mkdir -p /tmp/vanblog-release

nohup env BUILD_PROXY=http://127.0.0.1:10826 \
  pnpm release:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds \
  > /tmp/vanblog-release/core-vX.Y.Z.log 2>&1 &

# 观察进度；出现 ">>> Building <service>" 表示进入下一个镜像
grep -nE '>>> Building|pushing manifest|ERROR|CANCELED' /tmp/vanblog-release/core-vX.Y.Z.log | tail
```

核心镜像全部成功后，再用同样方式运行 all-in-one 发布：

```bash
nohup env BUILD_PROXY=http://127.0.0.1:10826 \
  pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds \
  > /tmp/vanblog-release/all-in-one-vX.Y.Z.log 2>&1 &
```

代理不可用、改走镜像源时，把上面两条命令里的 `BUILD_PROXY=...` 换成
`ALPINE_MIRROR_HOST=<可用镜像源> CLEAR_BUILD_PROXIES=true`，镜像源按 7.3 预检选择。

```bash
# 示例：退回镜像源方案
nohup env ALPINE_MIRROR_HOST=mirrors.tuna.tsinghua.edu.cn CLEAR_BUILD_PROXIES=true \
  pnpm release:all-in-one:publish --version vX.Y.Z --image-id <image-id> --skip-tests --skip-builds \
  > /tmp/vanblog-release/all-in-one-vX.Y.Z.log 2>&1 &
```

`--skip-builds` 会把宿主机上已有的构建产物直接复制进镜像（`website` 用
`packages/website/.next/standalone` 与 `.next/static`，`admin` 用 `packages/admin/dist`）。
发布前要确认这些产物是用本次发布的提交构建出来的，否则镜像里会是旧代码。
