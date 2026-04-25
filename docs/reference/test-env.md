---
title: 本机测试环境
---

# 本机测试环境

这台机器上有一套单独的 Docker Compose 测试环境，供 AI 或人工在不影响主仓库开发态的情况下做 `/admin`、`/api`、主题、登录态之类的联调。

## 位置

- 仓库源码目录：`/data/xiedong/vanblog`
- 测试环境目录：`/data/xiedong/test-vanblog`
- Compose 文件：`/data/xiedong/test-vanblog/docker-compose.yaml`
- Compose project name：`test-vanblog`
- 外部入口：`http://127.0.0.1:18083`

> 这是机器本地约定。测试环境目录不在仓库内，默认应进入 `/data/xiedong/test-vanblog` 操作，不要再假设旧目录 `/root/vanblog/test-env-vanblog` 仍然有效。

## 当前拓扑

这套环境通过 `docker compose` 启动以下服务：

- `caddy`
- `server`
- `website`
- `admin`
- `waline`
- `postgres`
- `redis`

其中：

- Caddy 对外暴露 `18083`
- `server`、`website`、`admin`、`waline` 通过容器内网络互通
- `docker-compose.yaml` 的构建上下文是 `../vanblog`，也就是 `/data/xiedong/vanblog`
- 这不是仓库开发态热更新环境，而是“从当前源码重新构建 Docker 镜像后部署到独立目录”的测试环境

## 启动 / 停止

进入测试环境目录：

```bash
cd /data/xiedong/test-vanblog
```

首次启动或整套重建：

```bash
docker compose up -d --build
```

停止但保留容器：

```bash
docker compose stop
```

停止并删除容器：

```bash
docker compose down
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f caddy server admin website waline
```

## 当前推荐部署方法

这套环境现在是“源码仓库”和“测试目录”分离的结构：

- 代码改在 `/data/xiedong/vanblog`
- 部署命令在 `/data/xiedong/test-vanblog` 执行

需要注意：

- `server` 镜像会在 Docker 构建阶段编译源码，通常不需要先在宿主机手动 build
- `admin` 镜像直接复制 `packages/admin/dist/`
- `website` 镜像直接复制 `packages/website/.next/standalone` 和 `packages/website/.next/static`

所以当你改了前端代码时，正确流程不是只跑 `docker compose up -d --build`，而是先在仓库根目录生成最新产物，再去测试目录重建容器。

### 1. 只改了后端

```bash
cd /data/xiedong/test-vanblog
docker compose up -d --build server
```

### 2. 改了后台 `admin`

```bash
cd /data/xiedong/vanblog
pnpm build:admin

cd /data/xiedong/test-vanblog
docker compose up -d --build admin
```

### 3. 改了前台 `website`

```bash
cd /data/xiedong/vanblog
pnpm build:website

cd /data/xiedong/test-vanblog
docker compose up -d --build website
```

### 4. 同时改了后台编辑器、前台渲染或接口

```bash
cd /data/xiedong/vanblog
pnpm build:admin
pnpm build:website

cd /data/xiedong/test-vanblog
docker compose up -d --build server website admin
```

### 5. 改了 Caddy 或需要整套重建

```bash
cd /data/xiedong/vanblog
pnpm build:admin
pnpm build:website

cd /data/xiedong/test-vanblog
docker compose up -d --build
```

## 配合仓库自动化测试怎么用

这套 test-env 适合人工验收，不替代仓库里的自动化测试：

- 改部署文档、compose、路由约束后：优先跑 `pnpm test:deploy`
- 改拆分服务运行链路后：再补 `pnpm test:blog-flow`
- 准备发版前：执行 `pnpm test:full`

test-env 更适合做这些事情：

- 在 `18083` 上手工验证 `/admin`、登录态、跳转和暗色模式
- 验证 `admin` 编辑器、预览区、前台展示链路是否和当前源码一致
- 用 debug token 快速拿到后台会话

## `/api/admin/auth/debug-token` 如何开启

这个接口默认不会匿名开放。它只有在 `server` 容器里配置了调试超级密钥后才可用。

### 1. 配置调试密钥

在测试环境目录创建或修改 `.env`：

```bash
cd /data/xiedong/test-vanblog
cat > .env <<'EOF'
VAN_BLOG_DEBUG_SUPER_TOKEN=vanblog-debug-test
EOF
```

也可以换成别的值，但后续请求头里的值必须完全一致。

### 2. 重建 `server`

```bash
cd /data/xiedong/test-vanblog
docker compose up -d --build server
```

如果想更稳一点，也可以直接整套重启：

```bash
cd /data/xiedong/test-vanblog
docker compose down
docker compose up -d --build
```

### 3. 确认环境变量已进入容器

```bash
cd /data/xiedong/test-vanblog
docker compose exec -T server /bin/sh -lc 'printenv | grep VAN_BLOG_DEBUG_SUPER_TOKEN'
```

正常应该看到类似：

```text
VAN_BLOG_DEBUG_SUPER_TOKEN=vanblog-debug-test
```

## 如何请求 `debug-token`

必须通过请求头 `x-debug-super-token` 传递密钥，不能放在 query string。

测试命令：

```bash
curl -i \
  -H 'x-debug-super-token: vanblog-debug-test' \
  http://127.0.0.1:18083/api/admin/auth/debug-token
```

如果配置成功，会返回 `200`，JSON 里带后台登录 token。

只取 JSON：

```bash
curl -s \
  -H 'x-debug-super-token: vanblog-debug-test' \
  http://127.0.0.1:18083/api/admin/auth/debug-token
```

如果返回：

- `debug token disabled`：说明容器里没有读到 `VAN_BLOG_DEBUG_SUPER_TOKEN`
- `debug token invalid`：说明请求头值和容器里的密钥不一致

## 典型联调流程

适合 AI 直接照着做：

```bash
cd /data/xiedong/test-vanblog
docker compose ps
docker compose exec -T server /bin/sh -lc 'printenv | grep VAN_BLOG_DEBUG_SUPER_TOKEN || true'
curl -s -H 'x-debug-super-token: vanblog-debug-test' http://127.0.0.1:18083/api/admin/auth/debug-token
```

拿到 token 后：

- 可以写入浏览器 `localStorage.token`
- 或在后续 `/api/admin/*` 请求里直接带 `token` 请求头

## 关闭 `debug-token`

如果不想保留这个调试入口：

1. 删除或清空 `/data/xiedong/test-vanblog/.env` 里的 `VAN_BLOG_DEBUG_SUPER_TOKEN`
2. 重建 `server`

例如：

```bash
cd /data/xiedong/test-vanblog
rm -f .env
docker compose up -d --build server
```

此后 `/api/admin/auth/debug-token` 会重新返回 `debug token disabled`。
