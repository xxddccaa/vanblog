### 1. 安装依赖

如果你没有安装 `docker`，可以通过以下命令安装：

```bash
curl -sSL https://get.daocloud.io/docker | sh
systemctl enable --now docker
```

::: tip

如果你没有接触过 `docker`，可以先看一下 [Docker 入门教程](https://www.ruanyifeng.com/blog/2018/02/docker-tutorial.html)。

:::

### 2. 获取仓库并使用内置编排

当前仓库已经自带 `docker-compose.yml`，不需要再手写单容器编排。推荐直接使用仓库根目录提供的多容器配置：

```bash
git clone https://github.com/xxddccaa/vanblog.git
cd vanblog
```

当前默认会启动以下服务：

- `caddy`: 对外统一入口，暴露 `80/443`
- `server`: 后端 API 与静态资源服务
- `website`: Next.js 前台
- `admin`: 后台静态页面
- `waline`: 评论服务
- `mongo`: 数据库，仅内网访问

::: warning 安全说明

默认配置下：

- `mongo` 不对外暴露端口
- Caddy admin API `2019` 不对外暴露端口
- 后台通过 `http://<你的域名>/admin` 访问，不需要单独暴露 `3002`

:::

### 3. 启动项目

在仓库根目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f caddy server website admin waline mongo
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
