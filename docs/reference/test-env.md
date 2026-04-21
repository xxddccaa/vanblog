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

## 可选：启用 AI 问答 / FastGPT

默认测试环境 **不包含** AI 问答扩展，这样不会影响原来的 `/admin`、`/api`、主题和登录联调。

如果需要在这台机器的 test-env 里联调 AI 问答，使用单独的 override：

- override 文件：`/root/vanblog/test-env-vanblog/docker-compose.ai-qa.yaml`
- FastGPT UI：`http://127.0.0.1:18100`
- MinIO API：`http://127.0.0.1:18110`
- MinIO Console：`http://127.0.0.1:18111`
- 如果要让 VanBlog admin 自动同步 bundled FastGPT 模型，需要在 test-env 的 `.env` 里同时提供 `FASTGPT_ROOT_PASSWORD`
- AI-QA override 里现在还会启动一个一次性的 `fastgpt-bootstrap`，自动补齐旧数据卷里缺失的免费套餐记录，避免 FastGPT 在创建 Dataset / App 时因为 `currentSubLevel` 缺失而报错

启动 AI 问答扩展：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml up -d --build
```

查看扩展状态：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml ps
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml logs -f server fastgpt-app
```

如果只想重建 AI 问答相关容器：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml up -d --force-recreate server fastgpt-app
```

停止 AI 问答扩展（同时保留原测试环境默认栈）：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml stop server fastgpt-app fastgpt-vector fastgpt-mongo fastgpt-redis fastgpt-minio fastgpt-code-sandbox fastgpt-plugin fastgpt-aiproxy fastgpt-aiproxy-pg
docker compose -f docker-compose.yaml -f docker-compose.ai-qa.yaml rm -f server fastgpt-app fastgpt-vector fastgpt-mongo fastgpt-redis fastgpt-minio fastgpt-code-sandbox fastgpt-plugin fastgpt-aiproxy fastgpt-aiproxy-pg
docker compose up -d server
```

说明：

- AI 问答只是 test-env 的可选覆盖层，不会改变 `docker-compose.yaml` 默认行为
- `server` 会通过容器内地址 `http://fastgpt-app:3000` 访问 FastGPT
- AI 工作台入口是 `/admin/ai`，对所有管理员开放；旧入口只是兼容跳转
- `/admin/ai` 页面里的“测试模型”会直接请求你填写的上游 `chat/completions` / `embeddings` 地址
- 如果还要让页面里的“同步模型到 FastGPT”可用，需要保证 `.env` 里的 `FASTGPT_ROOT_PASSWORD` 与 FastGPT root 实际密码一致
- 如果 `FASTGPT_ROOT_PASSWORD` 已正确注入，现在可以直接在 `/admin/ai` 点击“自动创建 Dataset / App / API Key”；完成后再执行“全量同步”即可开始问答
- 管理员问答历史会落库并共享，因此联调时要注意区分新会话与已有历史
- 如果 FastGPT 使用的是旧数据卷，`fastgpt-bootstrap` 会在启动后自动检查 `team_subscriptions`，缺失时补一条 free plan 记录

## 配合仓库自动化测试怎么用

这套 test-env 适合人工验收，不替代仓库里的自动化测试：

- 改部署文档、compose、路由约束后：优先跑 `pnpm test:deploy`
- 改拆分服务运行链路后：再补 `pnpm test:blog-flow`
- 准备发版前：执行 `pnpm test:full`

test-env 更适合做这些事情：

- 在 `18080` 上手工验证 `/admin`、`/admin/ai`、登录态、跳转和暗色模式
- 用 debug token 快速拿到后台会话
- 在不动主开发栈的前提下验证 bundled FastGPT 的真实表现

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
curl -i   -H 'x-debug-super-token: vanblog-debug-test'   http://127.0.0.1:18080/api/admin/auth/debug-token
```

如果配置成功，会返回 `200`，JSON 里带后台登录 token。

只取 JSON：

```bash
curl -s   -H 'x-debug-super-token: vanblog-debug-test'   http://127.0.0.1:18080/api/admin/auth/debug-token
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
