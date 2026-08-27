---
title: 本机测试环境
---

# 本机测试环境

这台机器上有一套**独立的 all-in-one 测试环境**，用 all-in-one 镜像 + 挂载宿主机预编译产物的方式，供 AI 或人工在不影响两套生产栈的前提下，快速验证还没发版的源码改动（`/admin`、`/api`、主题、登录态、markdown 渲染等联调）。

> 本文档只描述**这台机器当前实际在用的**测试环境。仓库里其它文档（如 `docs/quick-debug.md`）若指向 `/data/xiedong/test-vanblog`，在本机已失效，以本文档为准。

## 位置

- 仓库源码目录：`/root/vanblog/github_repo/vanblog`
- 测试环境目录：`/root/vanblog/test-env-vanblog`
- Compose 文件：`/root/vanblog/test-env-vanblog/docker-compose.all-in-one.latest.yml`（从仓库根目录复制过来）
- Compose project name：`test-env-vanblog`
- 外部入口：`http://127.0.0.1:8020`

生产栈占用 `8019`（`vanblog`）与 `13080`（`vanblog-cc`），测试环境固定用 `8020`，三者互不干扰。

## 当前拓扑

这套环境通过 `docker compose` 启动以下服务：

- `vanblog`：`kevinchina/deeplearning:vanblog-all-in-one-latest`（all-in-one 单镜像）
- `kroki`：`yuzutech/kroki`（图表渲染）

Caddy 对外暴露 `8020`，数据库 / redis 由 all-in-one 容器内部托管。

### 关键：用"挂载宿主机产物"而不是重建镜像

测试环境的 compose 把**宿主机预先编译好的产物**通过 volume 挂载进 all-in-one 容器，覆盖镜像内置产物：

| 宿主机产物（来源） | 容器内挂载点 | 说明 |
|------|-----------|------|
| `packages/server/dist` | `/app/server/dist` | node 进程加载，覆盖镜像内 server 产物 |
| `packages/website/.next/standalone/packages/website/.next` | `/app/website/packages/website/.next` | Next.js standalone 运行时加载 |
| `packages/admin/dist` | `/usr/share/nginx/html/admin`（`:ro`） | nginx 直接服务的静态产物 |

这样改代码后**只需宿主机重编 + 重启容器**（约 1 分钟），无需重建 all-in-one 镜像（镜像内重编要 8-12 分钟）。

> 与生产发版的区别：生产发版时，5 个核心拆分镜像的 `website`/`admin` 也是"宿主机预编译产物直接进镜像"（见 `docker/website.Dockerfile`、`docker/admin.Dockerfile`）；但 **all-in-one 镜像是镜像内重编**，不享用主机产物。测试环境这里反过来——复用 all-in-one 镜像，靠挂载把主机产物覆盖进去，从而跳过重编。详见 `RELEASE.md`。

## 首次启动

测试目录中的 compose 是在仓库原版基础上增加了三项源码产物 bind mount 的**本机专用副本**。已有测试目录直接使用现有文件，不要再用仓库原版覆盖，否则路径 A 会失效。首次搭建时应从当前正常工作的测试目录模板复制，或复制仓库原版后按上文表格手动补齐三项挂载。

```bash
TESTDIR=/root/vanblog/test-env-vanblog
mkdir -p "$TESTDIR" && cd "$TESTDIR"
# 确认 compose 已包含上文三项源码产物 bind mount 后，再创建 .env。

cat > "$TESTDIR/.env" <<'ENV'
VANBLOG_HTTP_PORT=8020
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_WORK_MEM=8MB
POSTGRES_MAINTENANCE_WORK_MEM=64MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_MAX_CONNECTIONS=50
POSTGRES_MAX_WAL_SIZE=1GB
REDIS_MAXMEMORY=256mb
ENV
# POSTGRES_PASSWORD / REDIS_PASSWORD 留空 -> entrypoint 自动生成强密钥到 ./secrets/

docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

停止 / 删除：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml stop     # 停止但保留容器
docker compose -f docker-compose.all-in-one.latest.yml down      # 停止并删除容器/网络
# 连测试数据一起清掉：
rm -rf /root/vanblog/test-env-vanblog/{data,log,caddy,aliyunpan,secrets}
```

## 改了代码怎么生效（路径 A）

在**仓库根目录** `/root/vanblog/github_repo/vanblog` 先重编产物，再去测试目录重启容器。

### 1. 只改了后端 `server`

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:server

cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

### 2. 改了前台 `website`

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:website
# next build 不会把 static 拷进 standalone，必须手动补，否则前台样式/脚本缺失
rm -rf packages/website/.next/standalone/packages/website/.next/static
cp -a packages/website/.next/static \
      packages/website/.next/standalone/packages/website/.next/static

cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

### 3. 改了后台 `admin`

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:admin
# admin 是 :ro 挂载，nginx 每次请求实时读目录，重编后立即生效，无需 restart
```

### 4. 同时改了多处

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:server
pnpm build:website
rm -rf packages/website/.next/standalone/packages/website/.next/static
cp -a packages/website/.next/static \
      packages/website/.next/standalone/packages/website/.next/static
pnpm build:admin

cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

## 为什么改完 server 必须 restart（挂载失效原理）

`nest build`（`pnpm build:server`）会**删除并重建** `packages/server/dist`，导致目录 inode 变化。而 bind mount 绑定的是旧 inode，重启前容器内 `/app/server/dist` 可能变成空目录，但容器不报错——server 继续跑旧代码。`docker compose restart` 会重新按路径绑定到新 inode。

**症状识别**：改了后端代码却"不生效"，先在容器里 `ls /app/server/dist/`，空的就说明挂载失效，restart 即可。

## 容器内路径速查（all-in-one 镜像）

| 组件 | 容器内路径 | 服务方式 | 改后是否需 restart |
|------|-----------|----------|------------------|
| server dist | `/app/server/dist`（volume 挂载） | node 进程 | ✅ 必须（inode + 内存） |
| website .next | `/app/website/packages/website/.next` | Next.js standalone | ✅ 必须（内存） |
| website static | `/app/website/packages/website/.next/static` | 随 .next 挂载 | 随 website 一起 |
| admin 静态产物 | `/usr/share/nginx/html/admin/`（`:ro`） | nginx | ❌ 无需（实时读目录） |
| Caddyfile | `/etc/caddy/Caddyfile` | caddy | ❌ 本方式不适用，需重建镜像 |

## 验证

```bash
# 约 40-60s 变为 healthy（首次 postgres init + server 启动）
docker inspect test-env-vanblog-vanblog-1 --format '{{.State.Health.Status}}'   # -> healthy
curl -s -o /dev/null -w "front %{http_code}\n"  http://127.0.0.1:8020/          # -> 200
curl -s -o /dev/null -w "admin %{http_code}\n"  http://127.0.0.1:8020/admin/    # -> 200
curl -s http://127.0.0.1:8020/api/public/init                                   # 233 未初始化 = 全新，去 /admin/ 初始化
```

前台长时间 `502` 就查日志：`docker logs test-env-vanblog-vanblog-1 --tail 30`（启动期一次性的 `ISRProvider ... ECONNRESET` 是无害的启动竞争）。

## `/api/admin/auth/debug-token` 如何开启

该接口默认不匿名开放，只在 `server` 容器配置了调试超级密钥后可用。

1. 在测试环境目录的 `.env` 里加一行：

   ```bash
   cd /root/vanblog/test-env-vanblog
   echo 'VAN_BLOG_DEBUG_SUPER_TOKEN=换成你自己的随机值' >> .env
   ```

2. 重启使环境变量进容器：

   ```bash
   docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
   ```

3. 确认已进入容器：

   ```bash
   docker compose -f docker-compose.all-in-one.latest.yml exec -T vanblog /bin/sh -lc 'printenv | grep VAN_BLOG_DEBUG_SUPER_TOKEN'
   ```

4. 用请求头 `x-debug-super-token` 取值（不能放 query string）：

   ```bash
   curl -s -H 'x-debug-super-token: 你的随机值' http://127.0.0.1:8020/api/admin/auth/debug-token
   ```

   返回 `200` 即成功；`debug token disabled` 说明容器没读到密钥；`debug token invalid` 说明请求头与容器内密钥不一致。

拿到 token 后可写入浏览器 `localStorage.token`，或在后续 `/api/admin/*` 请求里直接带 `token` 请求头。调试结束后清掉该 origin 的 site storage。

## 典型联调流程（AI 可直接照做）

```bash
cd /root/vanblog/github_repo/vanblog
# 1. 改代码
# 2. 按上面"改了代码怎么生效"重编对应产物
# 3. 重启
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
# 4. 等 healthy 后验证
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8020/
```

## 适用范围与坑

| 改动类型 | 路径 A 是否适用 | 说明 |
|----------|----------------|------|
| `packages/server` 代码 | ✅ | 宿主机 `pnpm build:server` + restart |
| `packages/website` 代码 | ✅ | 宿主机 `pnpm build:website` + 手动补 standalone 的 `static` + restart |
| `packages/admin` 代码 | ✅ | 宿主机 `pnpm build:admin`，无需 restart |
| 新增 npm 依赖 | ❌ | node_modules 在镜像内，路径 A 不生效，需重建 all-in-one 镜像 |
| Dockerfile / Caddy / entrypoint 改动 | ❌ | 需重建 all-in-one 镜像 |

- 容器重启时 PostgreSQL / redis 数据保持不变（数据在 `./data/postgres`、`./data/redis`）。
- website 的 `bracketMath.ts` 等新文件若引入新依赖（如 `unist-util-visit`），确认该依赖已在 `packages/website/package.json` 且镜像 `node_modules` 内存在；否则运行期会报模块缺失，此时只能重建镜像。
- `kroki` 容器不受 server/website/admin 重编影响，无需重启。

## 与仓库自动化测试的配合

test-env 适合人工验收，不替代仓库自动化测试：

- 改部署文档、compose、路由约束后：优先 `pnpm test:deploy`
- 改拆分/单镜像运行链路后：再补 `pnpm test:blog-flow` / `pnpm test:blog-flow:all-in-one`
- 准备发版前：`pnpm test:full`
