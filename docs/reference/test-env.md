---
title: 本机测试环境
---

# 本机测试环境

这台机器上有一套单独的 Docker Compose 测试环境，供 AI 或人工在不影响主仓库开发态的情况下做 `/admin`、`/api`、主题、登录态之类的联调。

## 位置

- 绝对路径：`/root/vanblog/test-env-vanblog`
- Compose 文件：`/root/vanblog/test-env-vanblog/docker-compose.yaml`
- Compose project name：`test`
- 外部入口：`http://127.0.0.1:18080`

> 这是**机器本地约定**，不是仓库内目录。下次 AI 看到本文档时，应优先去这个路径操作测试环境，而不是假设测试环境跟仓库在同一目录。

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

- Caddy 对外暴露 `18080`
- `server`、`website`、`admin`、`waline` 走容器内网络互通
- 当前测试环境主要使用预构建镜像，不是直接使用仓库工作区源码热更新

## 启动 / 停止

进入测试环境目录：

```bash
cd /root/vanblog/test-env-vanblog
```

启动：

```bash
docker compose up -d
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

## `/api/admin/auth/debug-token` 如何开启

这个接口默认**不会匿名开放**。它只有在 `server` 容器里配置了调试超级密钥后才可用。

### 1. 配置调试密钥

在测试环境目录创建 `.env`：

```bash
cd /root/vanblog/test-env-vanblog
cat > .env <<'EOF'
VAN_BLOG_DEBUG_SUPER_TOKEN=vanblog-debug-test
EOF
```

也可以换成别的值，但后续请求头里的值必须完全一致。

### 2. 只重建 `server`

```bash
cd /root/vanblog/test-env-vanblog
docker compose up -d --force-recreate server
```

如果想更稳一点，也可以直接整套重启：

```bash
cd /root/vanblog/test-env-vanblog
docker compose down
docker compose up -d
```

### 3. 确认环境变量已进入容器

```bash
cd /root/vanblog/test-env-vanblog
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
  http://127.0.0.1:18080/api/admin/auth/debug-token
```

如果配置成功，会返回 `200`，JSON 里带后台登录 token。

只取 JSON：

```bash
curl -s \
  -H 'x-debug-super-token: vanblog-debug-test' \
  http://127.0.0.1:18080/api/admin/auth/debug-token
```

如果返回：

- `debug token disabled`：说明容器里没有读到 `VAN_BLOG_DEBUG_SUPER_TOKEN`
- `debug token invalid`：说明请求头值和容器里的密钥不一致

## 典型联调流程

适合 AI 直接照着做：

```bash
cd /root/vanblog/test-env-vanblog
docker compose ps
docker compose exec -T server /bin/sh -lc 'printenv | grep VAN_BLOG_DEBUG_SUPER_TOKEN || true'
curl -s -H 'x-debug-super-token: vanblog-debug-test' http://127.0.0.1:18080/api/admin/auth/debug-token
```

拿到 token 后：

- 可以写入浏览器 `localStorage.token`
- 或在后续 `/api/admin/*` 请求里直接带 `token` 请求头

## 关闭 `debug-token`

如果不想保留这个调试入口：

1. 删除或清空 `/root/vanblog/test-env-vanblog/.env` 里的 `VAN_BLOG_DEBUG_SUPER_TOKEN`
2. 重建 `server`

例如：

```bash
cd /root/vanblog/test-env-vanblog
rm -f .env
docker compose up -d --force-recreate server
```

此后 `/api/admin/auth/debug-token` 会重新返回 `debug token disabled`。
