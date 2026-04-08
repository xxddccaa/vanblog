# 后台管理面板

基于 `umi.js` + `Ant Design Pro`。

## 本地开发

```bash
pnpm install
pnpm --filter @vanblog/admin dev
```

- 默认端口：`3002`
- 当前开发配置默认使用 `http`，生产构建会以 `/admin/` 子路径部署
- 如需联调后端，可直接通过仓库根目录运行 `pnpm dev` 或 `docker compose up -d --build`

## 常用命令

```bash
pnpm --filter @vanblog/admin build
pnpm --filter @vanblog/admin test
```
