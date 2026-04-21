### 1. 安装 Docker 与 Compose

如果服务器还没有 Docker，可以先安装：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

安装完成后确认版本：

```bash
docker --version
docker compose version
```

### 2. 获取仓库

```bash
git clone https://github.com/xxddccaa/vanblog.git
cd vanblog
```

当前仓库自带 `docker-compose.yml`，默认会启动以下服务：

- `caddy`：对外统一入口，暴露 `80/443`
- `server`：后端 API 与静态资源服务
- `website`：Next.js 前台
- `admin`：后台静态页面
- `waline`：独立评论服务
- `postgres`：主站与 Waline 共用的 PostgreSQL 实例，仅内网访问
- `redis`：缓存，仅内网访问

::: warning 安全说明

默认配置下：

- `postgres`、`redis` 不对外暴露端口
- Caddy admin API `2019` 不对外暴露端口
- 后台通过 `http://<你的域名>/admin` 访问，不需要单独暴露 `3002`
- Waline 管理页通过 `http://<你的域名>/api/ui/` 访问，不需要单独暴露 `8360/8361`

:::

::: info AI 说明

`docker-compose.yml` 默认**不会**启动 FastGPT，也不会自动给 `server` 注入 AI 工作台连接。

如果你需要 `/admin/ai`：

- 连接已有私有 FastGPT：叠加 `docker-compose.ai-qa.yml`
- 同机启动 bundled FastGPT：再叠加 `docker-compose.fastgpt.yml`

:::

### 3. 启动项目

在仓库根目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f caddy server website admin waline postgres redis
```

启动完成后，请继续 [完成初始化](./init.md)。

### 4. 常用维护命令

```bash
# 停止服务
docker compose down

# 停止并删除匿名卷（谨慎使用）
docker compose down -v

# 更新后重新构建启动
docker compose up -d --build
```
