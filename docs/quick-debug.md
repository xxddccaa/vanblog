# 快速调试工作流（Volume 挂载热更新）

本文档说明如何在不重建 Docker 镜像的情况下快速迭代 VanBlog 后端代码。

## 原理

测试目录 `/data/xiedong/test-vanblog/docker-compose.debug.yml` 将本地编译好的 server dist 目录通过 volume 挂载进 all-in-one 容器，覆盖镜像内置的编译产物。改代码后只需本地编译 + 重启容器，无需重建镜像。

```
本地源码修改 → pnpm build:server（3秒）→ docker restart（2秒）→ 等待 healthy（~40秒）
总计 ~45 秒，对比 Docker 全量重建 8-12 分钟，提速约 12 倍。
```

## 使用步骤

### 1. 启动调试环境

```bash
cd /data/xiedong/test-vanblog
docker compose -f docker-compose.debug.yml up -d
```

入口：`http://127.0.0.1:18083`

### 2. 修改代码 → 快速生效

```bash
# 1. 修改 packages/server/src/ 下的代码
# 2. 本地编译（增量编译约 3 秒）
pnpm --filter @vanblog/server build

# 3. 重启容器（volume 自动加载新 dist）
cd /data/xiedong/test-vanblog
docker compose -f docker-compose.debug.yml restart vanblog

# 4. 等待 ~40 秒后 healthy，即可测试
```

### 3. 停止调试环境

```bash
cd /data/xiedong/test-vanblog
docker compose -f docker-compose.debug.yml down
```

## 挂载说明

`docker-compose.debug.yml` 相比 `docker-compose.all-in-one.image.yml` 的关键区别：

```yaml
volumes:
  # 本地 server dist 直接挂载，覆盖镜像内的编译产物
  - /data/xiedong/vanblog/packages/server/dist:/app/server/dist
```

### 为什么改完代码必须 restart（dist 挂载失效原理）

`nest build` 会**删除并重建** `dist` 目录，导致目录 inode 变化。而 bind mount 绑定的是旧 inode，容器内看到的 `/app/server/dist` 会变成空目录（`ls` 无输出），但容器不会报错——server 继续跑着旧代码。`docker compose restart` 会重新解析挂载路径绑定到新 inode。**症状识别**：如果改了代码却"不生效"，先在容器里 `ls /app/server/dist/`，空的就说明挂载失效了，restart 即可。

## website / admin 热更新（docker cp 方案）

⚠️ **不要**把 website 的 `.next` 或 standalone 目录做成 volume 挂载——挂载会覆盖容器内的 `entrypoint.sh` 等文件导致容器起不来（踩过坑）。用 `docker cp` 热补丁：

```bash
# website：本地构建后 cp 进容器，需要 restart（node 进程要重新加载 server chunks）
pnpm --filter @vanblog/theme-default build
docker cp packages/website/.next/. test-vanblog-vanblog-1:/app/website/packages/website/.next/

# admin：静态文件由 nginx 直接服务，cp 后立即生效（restart 顺带做了也无妨）
pnpm --filter @vanblog/admin build
docker cp packages/admin/dist/. test-vanblog-vanblog-1:/usr/share/nginx/html/admin/

# 统一 restart（同时解决 server dist 挂载失效）
cd /data/xiedong/test-vanblog
docker compose -f docker-compose.debug.yml restart vanblog
```

容器内路径速查（all-in-one 镜像）：

| 组件 | 容器内路径 | 服务方式 |
|------|-----------|----------|
| server dist | `/app/server/dist`（volume 挂载） | node 进程 |
| website .next | `/app/website/packages/website/.next` | Next.js standalone |
| admin 静态产物 | `/usr/share/nginx/html/admin/` | nginx :3002 |
| Caddyfile | `/etc/caddy/Caddyfile` | caddy |

## 适用范围

| 改动类型 | 是否适用 | 说明 |
|----------|----------|------|
| `packages/server` 代码 | ✅ 适用 | 本地编译 + restart |
| `packages/website` 代码 | ✅ 适用 | 本地构建 + `docker cp` + restart（见上） |
| `packages/admin` 代码 | ✅ 适用 | 本地构建 + `docker cp`，无需 restart（见上） |
| Docker/Caddy 配置 | ❌ 不适用 | 需重建镜像 |
| 新增 npm 依赖 | ❌ 不适用 | 需重建镜像（node_modules 在镜像内） |

## 与其他调试方式的对比

| 方式 | 速度 | 覆盖面 | 适合场景 |
|------|------|--------|----------|
| **Volume 挂载**（本文） | ~45 秒 | server 代码 | 后端 API/逻辑快速迭代 |
| **host-debug**（`pnpm host:dev:up`） | 即时热重载 | server + website + admin | 日常开发，最快 |
| **Docker 全量重建** | 8-12 分钟 | 全部 | 发版前验证、Dockerfile 变更 |
| **docker cp** 热补丁 | ~5 秒 | 单个文件 | 紧急修一个文件验证 |

## 注意事项

- 容器重启时 PostgreSQL 数据保持不变（数据挂载在 `./data/postgres`）
- 如果容器启动失败，先检查本地 dist 是否编译成功：`ls packages/server/dist/src/`
- Kroki 和 PlantUML 容器不受影响，无需重启
