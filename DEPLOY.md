# 生产部署指南

这份文档面向需要把已经发布好的 VanBlog 多镜像部署到服务器的人类维护者和 AI 代理。

如果你要做的是“构建并发布镜像”，请看 `RELEASE.md`；如果你要做的是“把已经发布好的镜像部署到服务器”，请看这份文档。

当前代码基线已经推进到 `v1.8.4`，生产部署文档也统一以 `kevinchina/deeplearning` 这套长期保留镜像仓库为准。

## 1. 部署矩阵

当前建议把部署方式理解成三层：源码构建、latest 快速部署、版本锁定部署，再加一个可选的 all-in-one 单镜像部署。

| 目标 | 推荐文件 | 适用情况 |
| --- | --- | --- |
| 本机快速验证未发布代码 | 独立测试目录的 `docker-compose.all-in-one.latest.yml`（额外挂载本机编译产物） | **仅本机测试**；重编后约 1 分钟生效，不重建镜像 |
| 本地开发 / 改代码 | `docker-compose.yml` | 从源码构建，适合调试与联调 |
| latest 快速部署 | `docker-compose.latest.yml` + `.env` | 拉取 `latest` 主栈并显式配置数据库随机密码 |
| 锁定某个正式版本 | `docker-compose.image.yml` + `.env.release.example` | 生产推荐；精确回滚、审计、复现线上版本 |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | 只想维护一个主栈镜像 |
| 锁版单镜像 | `docker-compose.all-in-one.image.yml` + `.env.release.example` | 需要单镜像回滚 |

双轨说明：

- `docker-compose.latest.yml` 适合快速部署、个人维护、先把服务跑起来
- `docker-compose.image.yml` + `.env.release.example` 是生产首选，适合锁版、回滚、审计
- `docker-compose.all-in-one.latest.yml` / `docker-compose.all-in-one.image.yml` 适合希望线上只维护一个 VanBlog 容器的场景
- 下文的“本机快速测试”复用 all-in-one 镜像，但会挂载未发布的宿主机产物；它与生产部署隔离，**绝不能拿测试 compose 或测试目录部署生产**

## 2. 本机快速测试未发布代码（路径 A）

本机测试环境固定在：

- 源码仓库：`/root/vanblog/github_repo/vanblog`
- 测试目录：`/root/vanblog/test-env-vanblog`
- Compose project：`test-env-vanblog`
- 入口：`http://127.0.0.1:8020`

生产栈使用 `8019` 与 `13080`；测试栈使用 `8020`，必须保持独立的数据目录、Compose project 和端口。先确认端口可用：

```bash
ss -ltn | grep ':8020' || true
```

### 2.1 原理与前提

测试目录运行发布的 `kevinchina/deeplearning:vanblog-all-in-one-latest`，但其 compose 额外有以下三个 bind mount，用宿主机预编译产物覆盖镜像内产物：

```yaml
- /root/vanblog/github_repo/vanblog/packages/server/dist:/app/server/dist
- /root/vanblog/github_repo/vanblog/packages/website/.next/standalone/packages/website/.next:/app/website/packages/website/.next
- /root/vanblog/github_repo/vanblog/packages/admin/dist:/usr/share/nginx/html/admin:ro
```

因此快速验证流程是“**宿主机编译 → 重启测试容器 → 验证**”，而不是 `docker compose build`。不要用仓库原版 `docker-compose.all-in-one.latest.yml` 覆盖测试目录的 compose：原版没有上述三项产物挂载。

该方式适用于 `packages/server`、`packages/website`、`packages/admin` 的普通源码改动；新增 / 升级 npm 依赖，以及 Dockerfile、Caddy、entrypoint 改动，都必须改用完整 all-in-one 镜像重建。

### 2.2 推荐验证命令

把所有改动一次性编好后，只重启一次容器：

```bash
cd /root/vanblog/github_repo/vanblog

pnpm build:server
pnpm build:website
# Next.js 不会自动把 static 放进 standalone；先删掉旧目录，避免生成 static/static。
rm -rf packages/website/.next/standalone/packages/website/.next/static
cp -a packages/website/.next/static \
  packages/website/.next/standalone/packages/website/.next/static
pnpm build:admin

cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

`pnpm build:server` 会删除并重建 `dist`，原 bind mount 可能仍指向旧 inode；`restart` 会重新绑定它。website 也需要重启 Node 进程才会加载新产物。admin 由 nginx 直接读取只读挂载，重编后通常立即生效，但与前两者一起重启一次最便于统一验收。

等待健康状态后验证：

```bash
until [ "$(docker inspect test-env-vanblog-vanblog-1 \
  --format '{{.State.Health.Status}}')" = 'healthy' ]; do
  sleep 5
done

curl -s -o /dev/null -w 'front %{http_code}\n' http://127.0.0.1:8020/
curl -s -o /dev/null -w 'admin %{http_code}\n' http://127.0.0.1:8020/admin/
docker logs test-env-vanblog-vanblog-1 --tail 50
```

首次启动或 PostgreSQL 初始化约需 40–60 秒。前台持续 `502`、日志出现 `MODULE_NOT_FOUND` 或容器无法变为 `healthy` 时，停止验证并排查，不要碰 `vanblog`（8019）或 `vanblog-cc`（13080）生产目录。

> 若仅修改测试目录 `.env`，`restart` 不会重新读取环境变量，应执行 `docker compose -f docker-compose.all-in-one.latest.yml up -d --force-recreate vanblog`。这会重建**测试容器**但保留测试目录的数据卷。

更完整的本机测试说明见 `docs/reference/test-env.md`。

## 3. 服务器准备

建议服务器至少具备：

- 已安装 Docker
- 已安装 `docker compose` 或 `docker-compose`
- 默认 HTTP 部署时已开放 80 端口
- 如果要启用内置 Caddy HTTPS，再额外开放 443 端口
- 有一组可持久化的数据目录

把仓库中的这些文件带到服务器：

- `docker-compose.latest.yml`
- `docker-compose.image.yml`
- `docker-compose.all-in-one.latest.yml`
- `docker-compose.all-in-one.image.yml`
- `docker-compose.https.yml`
- `.env.release.example`
- 如有自定义配置，可额外带上自己的 `.env`

注意：

- 不要把 `postgres`、`redis` 单独映射到宿主机端口
- 不要把 Caddy admin API `2019` 暴露到公网
- 默认 HTTP-only 模式只需要暴露 `80`
- 如果叠加 `docker-compose.https.yml`，再额外暴露 `443`
- 默认官方拓扑会自动启用 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361`，不需要再额外开放 Waline 端口
- 默认镜像拓扑会把共享 Waline JWT 落盘到日志目录中的 `waline.jwt`

## 4. 如需锁版部署：生成服务器环境文件

先复制模板：

```bash
cp .env.release.example .env
```

然后至少修改这些内容：

- `EMAIL`
- `VANBLOG_DOCKER_REPO`
- `VANBLOG_RELEASE_SUFFIX`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `WALINE_JWT_TOKEN`
- 目录挂载项

如果 `WALINE_JWT_TOKEN` 留空，镜像运行时会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启会继续复用这份密钥。

备份加密使用独立的 `VANBLOG_BACKUP_ENCRYPTION_KEY`。留空时 server
镜像会生成并保存到独立的 `VANBLOG_SECRET_DIR` 下的
`backup-encryption.key`，不会复用数据库 JWT 或 Waline
JWT。使用异机/异地备份前，请把该密钥另存到独立的密码管理器或密钥系统；
只有 `.vbe` 文件而没有该密钥时无法恢复。

可选但常用的配置：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

## 5. 首次部署

### 5.1 latest 快速部署：主栈

```bash
printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个模板的特点：

- 直接写死 `kevinchina/deeplearning:vanblog-*-latest`
- 继续使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 必须用 `.env` 提供随机的 PostgreSQL 与 Redis 密码

### 5.2 锁版部署：版本化镜像

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

说明：

- 官方 `waline` 容器会在首次启动时尝试确保 `waline` 数据库存在
- 如果你改成了权限受限的数据库账号，导致容器无法自动建库，请手动补建 Waline 数据库

查看状态：

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f caddy server website admin waline postgres redis
```

首次启动后，访问：

```text
http://<你的域名或 IP>/admin/init
```

按页面引导完成初始化。

### 5.3 可选：启用内置 Caddy HTTPS

如果你不打算在外层再套自己的 Caddy / Nginx，而是希望直接使用 VanBlog 内置 Caddy 申请和管理证书，可改用：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

同时请确认：

- `.env` 中把 `VAN_BLOG_CADDY_MANAGE_HTTPS=true`
- 宿主机已开放 `80/443`
- 域名已经正确解析到当前服务器

## 6. 单镜像部署

如果你希望线上只维护一个容器，可以使用：

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

或锁版：

```bash
docker compose -f docker-compose.all-in-one.image.yml pull
docker compose -f docker-compose.all-in-one.image.yml up -d
```

这个路径仍然会把 PostgreSQL、Redis、Caddy、server、website、admin、waline 都收进一个容器，但数据目录仍走宿主机挂载。

### 6.1 直接 `docker run`

如果你不想维护 compose 文件，也可以直接启动 `all-in-one` 镜像。

最小可运行示例：

```bash
docker run -d \
  --name vanblog \
  --restart always \
  --init \
  --shm-size 1g \
  -p 80:80 \
  -v "$(pwd)/data/static:/app/static" \
  -v "$(pwd)/log:/var/log" \
  -v "$(pwd)/caddy/config:/root/.config/caddy" \
  -v "$(pwd)/caddy/data:/root/.local/share/caddy" \
  -v "$(pwd)/aliyunpan/config:/home/vanblog/.config/aliyunpan" \
  -v "$(pwd)/data/postgres:/var/lib/postgresql/data" \
  -v "$(pwd)/data/redis:/data/redis" \
  kevinchina/deeplearning:vanblog-all-in-one-latest
```

说明：

- 从当前代码基线开始，`kevinchina/deeplearning:vanblog-all-in-one-latest` 镜像会在未提供密码时生成随机 PostgreSQL / Redis 密码，并持久化到 `log/vanblog-secrets/`
- 也就是说，不传这些环境变量时，镜像会默认按下面这组值启动：
  - `POSTGRES_DB=vanblog`
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD`：自动生成，不再使用固定默认值
  - `POSTGRES_SHARED_BUFFERS=8GB`
  - `POSTGRES_WORK_MEM=32MB`
  - `POSTGRES_MAINTENANCE_WORK_MEM=1GB`
  - `POSTGRES_EFFECTIVE_CACHE_SIZE=24GB`
  - `POSTGRES_MAX_CONNECTIONS=200`
  - `POSTGRES_CHECKPOINT_TIMEOUT=15min`
  - `POSTGRES_MAX_WAL_SIZE=8GB`
  - `REDIS_SAVE_POLICY=900 1 300 10 60 10000`
  - `REDIS_APPENDONLY=yes`
  - `REDIS_MAXMEMORY=4gb`
  - `REDIS_MAXMEMORY_POLICY=allkeys-lru`
  - `VAN_BLOG_WALINE_DB=waline`
- 但 `docker run -d 镜像` 这件事有一个天然边界：端口映射、重启策略、`init`、`shm-size`、数据卷挂载，不可能由镜像自己替你强制加上，所以真正可上线的最小命令至少还是上面这种带 `-p` 和 `-v` 的写法
- 如果你希望改密码或改数据库名，推荐显式传环境变量，例如：

```bash
docker run -d \
  --name vanblog \
  --restart always \
  --init \
  --shm-size 1g \
  -p 80:80 \
  -e POSTGRES_PASSWORD='your-postgres-password' \
  -e EMAIL='you@example.com' \
  -e WALINE_JWT_TOKEN='your-waline-jwt-token' \
  -v "$(pwd)/data/static:/app/static" \
  -v "$(pwd)/log:/var/log" \
  -v "$(pwd)/caddy/config:/root/.config/caddy" \
  -v "$(pwd)/caddy/data:/root/.local/share/caddy" \
  -v "$(pwd)/aliyunpan/config:/home/vanblog/.config/aliyunpan" \
  -v "$(pwd)/data/postgres:/var/lib/postgresql/data" \
  -v "$(pwd)/data/redis:/data/redis" \
  kevinchina/deeplearning:vanblog-all-in-one-latest
```

如果你想把它进一步收敛成“一行命令”，建议额外提供一个官方 `scripts/docker-run-all-in-one.sh` 包装脚本，而不是指望裸 `docker run -d 镜像` 自动补齐宿主机参数。

## 7. 发版前检查与故障处理

正式的版本、tag 与镜像发布规范仍以 `RELEASE.md` 为准。本节记录本机实际发布 `v1.8.3` 时遇到的问题和已经验证过的处理方法，供后续发版直接复用。

### 7.1 推荐的完整发版顺序

发版前先确认工作区、版本号和远端状态：

```bash
cd /root/vanblog/github_repo/vanblog

git status --short
node -p "require('./package.json').version"
git rev-parse --short=8 HEAD
git log -5 --oneline
```

推荐顺序：

1. 整理本次发布范围，排除本机技能、内部台账、临时日志和无关生成物。
2. 更新 `package.json`、`.env.release.example`、`CHANGELOG.md`、`README.md`、`RELEASE.md`、`DEPLOY.md`、`docs/releases/README.md` 和本次 `docs/releases/vX.Y.Z.md`。
3. 执行最终门禁：

   ```bash
   pnpm test:full
   ```

4. 精确暂存本次文件并检查：

   ```bash
   git diff --cached --name-status
   git diff --cached --check
   git diff --cached --stat
   ```

5. 创建发布提交和 annotated tag，并取得镜像 id：

   ```bash
   git commit -m "chore(release): X.Y.Z"
   git tag -a vX.Y.Z -m "chore(release): X.Y.Z"
   IMAGE_ID="$(git rev-parse --short=8 HEAD)"
   ```

6. 推送 Git 后发布 5 个核心镜像，再发布 all-in-one：

   ```bash
   git push origin master
   git push origin vX.Y.Z

   bash scripts/release-publish.sh \
     --version vX.Y.Z \
     --image-id "$IMAGE_ID" \
     --skip-tests

   bash scripts/release-all-in-one-publish.sh \
     --version vX.Y.Z \
     --image-id "$IMAGE_ID" \
     --skip-tests
   ```

只有在**同一份发布内容**已经通过 `pnpm test:full` 时，镜像发布命令才使用 `--skip-tests`，避免重复运行 Compose E2E；脚本仍会预构建 website/admin 所需产物。未跑完整门禁时不要跳过测试。

> `git commit`、`git tag`、`git push` 和镜像推送都是对外发布动作。人工操作前必须再次核对版本、目标仓库和发布范围；AI 代理必须先取得明确批准。

### 7.2 发版前必须处理脏工作区

发布脚本遇到未提交改动会提示：

```text
Warning: git worktree is not clean. Releasing from a dirty tree may reduce traceability.
```

这个警告不能默认忽略。Docker 构建上下文读取的是当前文件系统，不只读取 Git 提交；未提交或未跟踪文件即使没有进入发布提交，也可能影响 website/admin/mind-map 构建产物，导致镜像标签写着某个 Git SHA，实际内容却不完全对应这个提交。

推荐做法：

- 发布前让工作区保持干净；确需保留的无关改动先由维护者明确处理。
- 不要把 `.claude/`、内部审计台账、测试日志、临时数据目录和无关生成物加入发布提交。
- 提交后再次执行 `git status --short`；如果仍有改动，先确认它们不会进入任何 Docker 构建输入，再继续镜像发布。
- 不要为了消除警告直接使用 `git reset --hard`、`git clean` 或删除不属于本次任务的文件。

### 7.3 Docker 代理导致健康检查 unhealthy

#### 症状

容器内服务进程和端口都正常，但 website、admin 或 Waline 一直显示 `unhealthy`，健康日志类似：

```text
wget: can't connect to remote host (127.0.0.1): Connection refused
```

检查容器环境后会发现 Docker daemon 自动注入了代理：

```bash
docker exec <container> sh -lc 'env | sort | grep -i proxy'
```

Alpine BusyBox `wget` 可能不会按预期遵守 `NO_PROXY`，把 `127.0.0.1` 健康请求发往容器内并不存在的代理端口。

#### 已采用的修复

所有 Compose 本地 HTTP 健康检查都使用：

```text
wget -Y off ...
```

修改 Compose 健康检查时不得去掉 `-Y off`。静态回归由 `tests/deployment-config.test.mjs` 约束。

### 7.4 Docker 代理导致 Caddy 502 或初始化超时

#### 症状

- Caddy 已启动，但 `/api/ui/` 返回 `502`。
- Caddy 错误日志出现：

  ```text
  proxyconnect tcp: dial tcp 127.0.0.1:10826: connect: connection refused
  ```

- 初始化数据已经写入，`/api/admin/init/check` 返回 `initialized:true`，但原始 `POST /api/admin/init` 仍在等待并最终超时。

#### 根因

Docker daemon 把 `HTTP_PROXY` / `HTTPS_PROXY` 注入容器，但原来的 `NO_PROXY` 只有 `localhost,127.0.0.1`：

- Caddy → `server` / `website` / `admin` / `waline` 会错误走代理，返回 502。
- server 初始化后同步调用 `website:3011` 和 `waline:8361`，Axios 自动读取代理变量，导致初始化请求等待外部控制调用超时。

#### 已采用的修复

拆分 Compose 的 Caddy、server、website、Waline 均显式配置大小写两组代理例外：

```yaml
NO_PROXY: localhost,127.0.0.1,server,website,admin,waline,postgres,redis,kroki
no_proxy: localhost,127.0.0.1,server,website,admin,waline,postgres,redis,kroki
```

排查时使用：

```bash
# 查看 Caddy 是否错误连接代理
docker exec <caddy-container> sh -lc 'tail -50 /var/log/caddy.log'

# 从 Caddy 容器直连 Waline
docker exec <caddy-container> \
  wget -Y off -S -O - http://waline:8360/ui/

# 查看 server / Caddy 的代理变量
docker exec <container> sh -lc 'env | sort | grep -i proxy'
```

修改服务名或新增内部服务时，必须同步更新 `NO_PROXY` / `no_proxy` 和部署测试。

### 7.5 all-in-one 构建出现 `cannot allocate memory`

#### 症状

5 个核心镜像发布成功，但 all-in-one 在镜像内执行 `pnpm build:website` 时失败：

```text
ResourceExhausted: ... cannot allocate memory
```

宿主机看起来仍有空闲内存，但当前 BuildKit builder 可能被单独限制为 2 GiB。检查方式：

```bash
free -h
docker stats --no-stream
docker buildx inspect vanblog-release --bootstrap
docker inspect buildx_buildkit_vanblog-release0 \
  --format 'memory={{.HostConfig.Memory}} swap={{.HostConfig.MemorySwap}}'
```

`memory=2147483648` 表示 builder 只有 2 GiB，无法满足 all-in-one 的 server + Next.js + admin 镜像内连续构建。

#### 本机已验证的处理方法

在不停止三套运行栈的情况下，创建一个 6 GiB、7 GiB memory+swap 上限的专用 builder：

```bash
docker buildx create \
  --name vanblog-all-in-one-release \
  --driver docker-container \
  --driver-opt network=host \
  --driver-opt env.http_proxy=http://127.0.0.1:10826 \
  --driver-opt env.https_proxy=http://127.0.0.1:10826 \
  --driver-opt memory=6g \
  --driver-opt memory-swap=7g \
  --use \
  --bootstrap

docker buildx inspect vanblog-all-in-one-release
```

然后原命令直接重试：

```bash
bash scripts/release-all-in-one-publish.sh \
  --version vX.Y.Z \
  --image-id <image-id> \
  --skip-tests
```

注意：

- 创建前先用 `free -h` 确认宿主机可用内存；不要通过停止生产容器给构建让路。
- 当前本机代理端口是 `127.0.0.1:10826`；代理配置变化时同步修改 builder driver options。
- `docker buildx` 发布脚本使用当前选中的 builder，可用 `docker buildx ls` 确认名称后再运行。
- 构建失败发生在推送前时，可以安全重试相同版本和 image id；脚本会复用可用缓存并在结束时验证标签。

### 7.6 发布后必须独立验证 Git 和镜像标签

不要只依据脚本退出码。至少验证远端 Git 指针、版本标签与 `latest` 标签中的镜像 labels：

```bash
IMAGE_REPO=kevinchina/deeplearning
VERSION=vX.Y.Z
IMAGE_ID=<image-id>

for service in caddy server website admin waline all-in-one; do
  for tag in \
    "$IMAGE_REPO:vanblog-$service-$VERSION" \
    "$IMAGE_REPO:vanblog-$service-latest"; do
    docker pull "$tag"
    docker image inspect "$tag" --format \
      'version={{index .Config.Labels "org.opencontainers.image.version"}} id={{index .Config.Labels "io.vanblog.image.id"}}'
  done
done

git ls-remote origin refs/heads/master
git ls-remote origin refs/tags/$VERSION^{}
```

所有镜像的 `version` 都应等于本次 `vX.Y.Z`，`id` 都应等于本次 8 位 Git SHA；远端 `master` 与 annotated tag 解引用后的提交也应指向同一个完整 SHA。

生产锁版参数最终记录为：

```bash
VANBLOG_DOCKER_REPO=kevinchina/deeplearning
VANBLOG_RELEASE_SUFFIX=vX.Y.Z-<image-id>
```

## 8. 上线后建议检查

- `http://<你的域名>/admin` 是否正常打开
- `http://<你的域名>/admin/init` 是否只在未初始化时出现
- 前台首页、文章页、分类页、标签页是否正常访问
- 评论、图片、RSS 是否仍可访问
- `docker compose logs -f caddy server website admin waline postgres redis` 是否有明显报错

## 9. 最小结论

如果你只是想稳定上线博客主栈：

1. 生产推荐 `docker-compose.image.yml` + `.env.release.example`
2. 快速试跑用 `docker-compose.latest.yml`
3. 想少维护一个容器时，用 `docker-compose.all-in-one*.yml`
