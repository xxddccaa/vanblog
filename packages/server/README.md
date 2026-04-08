# 博客后端

采用 `NestJS` 构建。

## 本地开发

```bash
pnpm install
pnpm --filter @vanblog/server dev
```

- 默认端口：`3000`
- Swagger 路径：`/swagger`
- 多容器部署时由 `caddy` 统一对外转发，容器内通过 `server:3000` 访问

## 测试命令

```bash
pnpm --filter @vanblog/server test
pnpm --filter @vanblog/server test:e2e
```

## 数据库配置

默认数据库连接可通过环境变量 `VAN_BLOG_DATABASE_URL` 控制；当前 compose 默认使用：

```text
mongodb://mongo:27017/vanBlog?authSource=admin
```

开发时如果需要覆盖，也可以在 `packages/server` 目录下新建 `config.yaml`：

```yaml
database:
  url: mongodb://somemongo:27017/vanBlog?authSource=admin
static:
  path: /path/to/staticFolder
```
