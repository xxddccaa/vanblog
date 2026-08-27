# 快速调试工作流（all-in-one 产物挂载）

本文档是 `docs/reference/test-env.md` 的简化操作版，说明如何用当前机器的独立测试环境快速验证还未发布的 server、website 和 admin 源码改动。

## 当前环境

- 源码：`/root/vanblog/github_repo/vanblog`
- 测试目录：`/root/vanblog/test-env-vanblog`
- Compose：`/root/vanblog/test-env-vanblog/docker-compose.all-in-one.latest.yml`
- Compose project：`test-env-vanblog`
- 入口：`http://127.0.0.1:8020`
- 容器：`test-env-vanblog-vanblog-1` + `test-env-vanblog-kroki-1`

生产栈使用 `8019` 和 `13080`。测试环境必须保留独立目录、端口和 Compose project，不要操作两个生产目录。

## 原理

测试目录的 compose 是本机专用副本，在发布的 all-in-one 镜像上额外挂载宿主机预编译产物：

```yaml
volumes:
  - /root/vanblog/github_repo/vanblog/packages/server/dist:/app/server/dist
  - /root/vanblog/github_repo/vanblog/packages/website/.next/standalone/packages/website/.next:/app/website/packages/website/.next
  - /root/vanblog/github_repo/vanblog/packages/admin/dist:/usr/share/nginx/html/admin:ro
```

因此普通代码修改无需重建 all-in-one 镜像，只需在宿主机编译对应产物，再重启测试容器。

> 不要用仓库原版 `docker-compose.all-in-one.latest.yml` 覆盖测试目录里的文件。仓库原版没有上述三项调试挂载，覆盖后路径 A 会失效。

## 推荐：多处改动一次编译、一次重启

```bash
cd /root/vanblog/github_repo/vanblog

pnpm build:server
pnpm build:website
# Next.js 不会自动把 static 放进 standalone；先删除旧目录，避免 static/static。
rm -rf packages/website/.next/standalone/packages/website/.next/static
cp -a packages/website/.next/static \
  packages/website/.next/standalone/packages/website/.next/static
pnpm build:admin

cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

等待健康状态：

```bash
until [ "$(docker inspect test-env-vanblog-vanblog-1 \
  --format '{{.State.Health.Status}}')" = 'healthy' ]; do
  sleep 5
done

curl --noproxy '*' -sS -o /dev/null -w 'front %{http_code}\n' \
  http://127.0.0.1:8020/
curl --noproxy '*' -sS -o /dev/null -w 'admin %{http_code}\n' \
  http://127.0.0.1:8020/admin/
curl --noproxy '*' -sS \
  http://127.0.0.1:8020/api/admin/init/check
```

初始化状态接口应返回 `200`，JSON 中 `initialized` 为 `true` 或 `false`。

## 只改一个组件

### server

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:server
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

`pnpm build:server` 会删除并重建 `dist`，使 bind mount 指向的 inode 变化，所以必须 restart。若修改不生效，先检查：

```bash
docker exec test-env-vanblog-vanblog-1 ls /app/server/dist/
```

容器内目录为空通常说明需要重新 restart 以绑定新的 inode。

### website

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:website
rm -rf packages/website/.next/standalone/packages/website/.next/static
cp -a packages/website/.next/static \
  packages/website/.next/standalone/packages/website/.next/static
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml restart vanblog
```

website 的 Node 进程需要重启才能加载新的 server chunks。

### admin

```bash
cd /root/vanblog/github_repo/vanblog
pnpm build:admin
```

admin 静态产物以只读 bind mount 提供给 nginx，构建完成后通常立即生效；与其他组件一起验收时统一 restart 一次也可以。

## 修改 `.env` 时不能只 restart

`docker compose restart` 不会重新解析 `.env`。修改测试环境变量后应 recreate 测试容器：

```bash
cd /root/vanblog/test-env-vanblog
docker compose -f docker-compose.all-in-one.latest.yml \
  up -d --force-recreate --no-deps vanblog
```

该操作只重建测试容器，测试数据仍由目录挂载保留。

## 适用范围

| 改动类型 | 是否适用 | 处理方式 |
| --- | --- | --- |
| `packages/server` 普通代码 | 是 | build server + restart |
| `packages/website` 普通代码 | 是 | build website + 同步 static + restart |
| `packages/admin` 普通代码 | 是 | build admin；通常无需 restart |
| 新增或升级 npm 依赖 | 否 | 重建 all-in-one 镜像 |
| Dockerfile / Caddy / entrypoint | 否 | 重建 all-in-one 镜像 |
| 数据库结构或容器拓扑 | 否 | 按完整测试/迁移流程处理 |

Kroki 容器不受 server、website、admin 重编影响，无需重启。

## 与其他调试方式对比

| 方式 | 入口 | 适合场景 |
| --- | --- | --- |
| host-debug | `18080` | 日常开发，server/website/admin 热更新最快 |
| 本文路径 A | `8020` | 用 all-in-one 运行形态快速验证宿主机产物 |
| split Docker 源码构建 | `18080` 或自定义端口 | Caddy、依赖、Dockerfile、拆分服务链路验收 |
| 完整 all-in-one 重建 | 自定义端口 | 发版前验证 all-in-one Dockerfile 和依赖图 |

完整说明、debug-token 配置和首次搭建注意事项见 `docs/reference/test-env.md`。
