# 博客前台

采用 `Next.js` 构建。

## 本地开发

```bash
pnpm install
pnpm --filter @vanblog/theme-default dev
```

- 默认端口：`3001`
- 容器运行期默认通过 `VAN_BLOG_SERVER_URL=http://server:3000` 访问后端
- 浏览器端优先使用相对路径，避免拆分部署后跨域或错误跳转

## 常用命令

```bash
pnpm --filter @vanblog/theme-default build
pnpm --filter @vanblog/theme-default test -- --run
```
