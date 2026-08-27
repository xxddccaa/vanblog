# 博客后端

采用 `NestJS` 构建。

## 本地开发

```bash
pnpm install
pnpm --filter @vanblog/server dev
```

- 默认端口：`3000`
- Swagger 路径：`/swagger`（仅通过主机本地或容器内的 server 入口访问；公网 Caddy 入口返回 404）
- 多容器部署时业务 API 由 `caddy` 统一对外转发，容器内通过 `server:3000` 访问

## 测试命令

```bash
pnpm --filter @vanblog/server test
pnpm --filter @vanblog/server test:e2e
```

## 数据库配置

默认主数据库连接可通过环境变量 `VAN_BLOG_DATABASE_URL` 控制；当前 compose 默认使用：

```text
postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/vanblog
```

缓存连接可通过 `VAN_BLOG_REDIS_URL` 控制；当前 compose 默认使用：

```text
redis://:<REDIS_PASSWORD>@redis:6379
```

开发时如果需要覆盖，也可以在 `packages/server` 目录下新建 `config.yaml`：

```yaml
database:
  url: postgresql://postgres:<本地强密码>@127.0.0.1:5432/vanblog
redis:
  url: redis://:<本地强密码>@127.0.0.1:6379
static:
  path: /path/to/staticFolder
```
