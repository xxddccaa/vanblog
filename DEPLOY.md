# 生产部署指南

这份文档面向需要把已经发布好的 VanBlog 多镜像部署到服务器的人类维护者和 AI 代理。

如果你要做的是“构建并发布镜像”，请看 `RELEASE.md`；如果你要做的是“把已经发布好的镜像部署到服务器”，请看这份文档。

当前代码基线已经推进到 `v1.8.3`，生产部署文档也统一以 `kevinchina/deeplearning` 这套长期保留镜像仓库为准。

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

## 7. 上线后建议检查

- `http://<你的域名>/admin` 是否正常打开
- `http://<你的域名>/admin/init` 是否只在未初始化时出现
- 前台首页、文章页、分类页、标签页是否正常访问
- 评论、图片、RSS 是否仍可访问
- `docker compose logs -f caddy server website admin waline postgres redis` 是否有明显报错

## 8. 最小结论

如果你只是想稳定上线博客主栈：

1. 生产推荐 `docker-compose.image.yml` + `.env.release.example`
2. 快速试跑用 `docker-compose.latest.yml`
3. 想少维护一个容器时，用 `docker-compose.all-in-one*.yml`
