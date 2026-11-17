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
- `server`：后端 API、静态资源服务与原生评论
- `website`：Next.js 前台
- `admin`：后台静态页面
- `postgres`：PostgreSQL 实例，存放博客内容与评论，仅内网访问
- `redis`：缓存，仅内网访问

::: warning 安全说明

默认配置下：

- `postgres`、`redis` 不对外暴露端口
- Caddy admin API `2019` 不对外暴露端口
- 后台通过 `http://<你的域名>/admin` 访问，不需要单独暴露 `3002`
- 评论由 `server` 内置提供，在后台 `站点管理/评论管理` 中管理，没有需要额外暴露的评论端口

:::

### 3. 启动项目

在仓库根目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f caddy server website admin postgres redis
```

启动完成后，请继续 [完成初始化](./init.md)。

### 4. 常用维护命令

```bash
docker compose down
docker compose down -v
docker compose up -d --build
```
