# 18080 调试工作流

这台机器现在约定了两种常用调试方式，二者都可以把博客入口放到 `18080`，方便外层穿透或反向代理统一指向同一个端口：

1. Docker compose 调试：更接近镜像/生产行为，适合做回归和验收
2. 宿主机调试：改代码更快，适合快速修功能

如果这台机器联网需要代理，先导出：

```bash
export http_proxy=http://127.0.0.1:10829
export https_proxy=http://127.0.0.1:10829
```

## 先看结论

| 模式 | 入口 | 适用场景 | 启动命令 | 停止命令 |
| --- | --- | --- | --- | --- |
| Docker 镜像态调试 | `http://127.0.0.1:18080` | 验证 `/admin` 子路径、静态资源、Caddy、镜像行为 | `docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 up -d` | `docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 down` |
| Docker 源码构建调试 | `http://127.0.0.1:18080` | 想直接用当前仓库源码构建整套容器 | `VANBLOG_HTTP_PORT=18080 docker compose up -d --build` | `VANBLOG_HTTP_PORT=18080 docker compose down` |
| 宿主机快速调试 | `http://127.0.0.1:18080` | 快速改 `server` / `website` / `admin` 并立即看效果 | `pnpm host:dev:up` | `pnpm host:dev:down` |

后续 AI 默认按这个判断：

- 需要“快速修、快速看”时，优先用宿主机调试
- 需要“确认镜像态没问题”时，回到 Docker compose 调试
- 涉及 `/admin` 子路径、静态资源、Caddy、容器健康检查时，不能只看宿主机调试结果，必须再跑一次 Docker 调试

## Docker compose 调试

```bash
docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 up -d
```

查看状态和日志：

```bash
docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 ps
docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 logs -f caddy server website admin waline postgres redis
```

停止：

```bash
docker compose -f tests/manual-v1.3.0/docker-compose.yaml -p vanblog-manual-v130 down
```

说明：

- 这套 compose 使用的是 `tests/manual-v1.3.0/docker-compose.yaml`
- 它固定把 `caddy` 暴露到宿主机 `18080`
- 这套方式最接近镜像实际运行形态，适合做最终验收
- 当前运行数据目录在 `tests/manual-v1.3.0/runtime/`

如果你想直接用当前仓库源码构建 Docker，而不是使用 `tests/manual-v1.3.0` 那套镜像，也可以：

```bash
VANBLOG_HTTP_PORT=18080 docker compose up -d --build
```

## 宿主机快速调试

适用场景：需要快速迭代 `server` / `website` / `admin` 代码，但又希望运行时依赖、端口和 Docker 栈尽量保持一致。

## 设计原则

- `server`、`website`、`admin`、`waline` 运行在宿主机，便于热更新和直接调试
- `postgres`、`redis` 继续跑在 Docker 里，避免宿主机环境漂移
- 端口、数据库地址、控制接口地址与正式 compose 保持同一套命名和职责
- 默认复用 `tests/manual-v1.3.0/runtime/data` 这套数据目录，方便直接试当前博客内容
- 因为要复用同一份数据，启动宿主机调试链路前会自动关闭 `vanblog-manual-v130` 手动 Docker 栈
- 宿主机调试完成后，仍要回到 `tests/manual-v1.3.0/docker-compose.yaml` 做一次镜像态验收

## 端口映射

| 服务 | 宿主机端口 | 说明 |
| --- | --- | --- |
| server | `3000` | NestJS API / Swagger |
| website | `3001` | Next.js 前台 |
| website control | `3011` | 供 server 同步 ISR / 运行时配置 |
| admin | `3002` | Umi 后台开发服务 |
| waline | `8360` | 评论服务 |
| waline control | `8361` | 供 server 同步 Waline 配置 |
| host proxy | `18080` | 供你直接按原试用入口访问 |
| postgres | `15432` | Docker 依赖，仅本机调试使用 |
| redis | `16379` | Docker 依赖，仅本机调试使用 |

## 一键命令

在仓库根目录执行：

```bash
pnpm host:dev:up
```

关闭：

```bash
pnpm host:dev:down
```

查看状态：

```bash
pnpm host:dev:status
```

如果要直接看某个宿主机服务的实时输出，可附着到对应 `tmux` 会话：

```bash
tmux attach -t vanblog-host-server
tmux attach -t vanblog-host-website
tmux attach -t vanblog-host-admin
tmux attach -t vanblog-host-waline
```

退出附着但不停止服务：

```bash
Ctrl+b 然后按 d
```

## 改完代码后什么时候会生效

宿主机调试模式之所以快，是因为 `server` / `website` / `admin` / `waline` 直接跑在宿主机开发态，不需要反复重建 Docker 镜像。

通常可以按下面这条经验判断：

- 改页面、样式、组件、接口逻辑：一般会自动生效
- 改代理、端口、启动参数、环境变量：通常需要重启宿主机调试栈

更具体一点：

- `packages/server`
  - 当前通过 `pnpm --filter @vanblog/server dev` 运行
  - Nest 开发态会自动重启
  - 改 controller/provider/service 等后端代码，通常保存后就生效
- `packages/website`
  - 当前通过 Next dev server 运行
  - 页面、组件、样式改动一般会自动热更新或自动重编译
- `packages/admin`
  - 当前通过 Umi dev server 运行
  - 页面、组件、样式改动一般会自动重新编译
  - 所以多数后台 UI 修复，不需要手动重启整套链路
- `packages/waline`
  - 当前由宿主机 runner 托管
  - 普通代码改动如果没被 runner 自动接管，优先看 `tests/host-dev/runtime/log/waline.log`

## 哪些情况必须重启 host-debug

遇到下面这些改动，不要只等热更新，直接执行一次：

```bash
pnpm host:dev:down
pnpm host:dev:up
```

典型场景：

- 改了 `tests/host-dev/Caddyfile`
- 改了 `scripts/host-dev-up.sh`、`scripts/host-dev-down.sh`、`scripts/host-dev-env.sh`
- 改了端口、反向代理规则、宿主机环境变量
- 改了服务启动参数
- 需要重新初始化 host-debug 依赖状态时

## 什么时候不能只看宿主机结果

宿主机调试适合“快速修功能”，但下面这些问题修完后，仍然要回 Docker `18080` 再验一次：

- `/admin` 子路径路由
- 静态资源路径
- Caddy 转发
- WebSocket / HMR 代理
- 容器健康检查
- 镜像构建产物差异
- 只会在 production / image 环境出现的问题

也就是说：

- 快速迭代：先 `pnpm host:dev:up`
- 镜像验收：再用 `tests/manual-v1.3.0/docker-compose.yaml` 或源码 compose 的 `18080` 方案复验

## 关键文件

- Docker 依赖编排：`tests/host-dev/docker-compose.yaml`
- 宿主机反向代理：`tests/host-dev/Caddyfile`
- 宿主机环境变量：`scripts/host-dev-env.sh`
- 数据库/Waline 初始化：`scripts/ensure-host-dev-db.mjs`
- Website 控制器：`scripts/host-website-runner.cjs`
- Waline 控制器：`scripts/host-waline-runner.cjs`
- 启停脚本：`scripts/host-dev-up.sh`、`scripts/host-dev-down.sh`
- 日志目录：`tests/host-dev/runtime/log`
- 宿主机常驻进程通过 `tmux` 会话托管，避免 CLI 命令结束后子进程被回收

## 与 Docker 保持一致的点

- 数据源仍然是 PostgreSQL + Redis，而不是宿主机随意装的本地服务
- `server` 仍通过：
  - `VANBLOG_WEBSITE_CONTROL_URL=http://127.0.0.1:3011`
  - `VANBLOG_WALINE_CONTROL_URL=http://127.0.0.1:8361`
  - `VANBLOG_WEBSITE_ISR_BASE=http://127.0.0.1:3001/api/revalidate?path=`
  来驱动前台和评论服务
- `http://127.0.0.1:18080` 由宿主机 Caddy 反向代理到 host 上的 website/admin/server/waline，路由规则与 Docker 版保持一致
- `website` 与 `admin` 开发态仍然把 `/api` 转发给 `http://127.0.0.1:3000`
- `waline` 仍然使用与 Docker 一致的 PostgreSQL 数据库 `waline`

## 与 Docker 不同的点

- 这是开发态，`NODE_ENV=development`
- `admin` 是 Umi dev server，入口直接看 `http://127.0.0.1:3002`
- `website` 是 Next dev server，入口直接看 `http://127.0.0.1:3001`
- 由于复用了 `tests/manual-v1.3.0/runtime/data`，这套宿主机环境更适合“直接试博客现在内容”
- 真正与生产最接近的反向代理、静态产物、镜像层问题，仍需用手动 compose 栈复验

## AI 调试约定

当用户要求“先快速修功能，再看效果”时，优先使用这套宿主机调试链路：

1. `pnpm host:dev:up`
2. 在宿主机直接修改 `packages/server`、`packages/website`、`packages/admin`
3. 通过 `tests/host-dev/runtime/log/*.log` 看日志
4. 修完后至少再做一次：
   - `pnpm build:admin`
   - `pnpm build:website`
   - 或用 `tests/manual-v1.3.0/docker-compose.yaml` 做镜像态验收

如果问题只会在 `/admin` 子路径、镜像静态资源、Caddy 转发、容器健康检查里出现，不要只依赖宿主机调试结果，必须再回到 Docker 栈复验。

## Admin 调试 token / MCP 建议

当问题发生在 `/admin` 的登录态、编辑器、主题、缓存、列表页或浏览器行为层时，单看接口返回通常不够，建议配合浏览器 MCP 做真实页面验证。

- debug super token 只用于本机或测试环境的临时调试，不用于生产环境
- 不要把真实 token 写进仓库文件、脚本、测试夹具、截图说明或最终对外回复
- 调试时优先用一次性的请求头或环境变量注入 token，不要做持久化配置
- `http://127.0.0.1:18080` 与外部转发出来的公网地址/IP 属于不同 origin，`localStorage`、登录态、缓存彼此独立，必须分别验证
- 遇到 `/admin` 编辑器或后台主题异常时，除了看接口是否 `200`，还要一起检查：
  - 当前 origin 下的 `localStorage` / `sessionStorage`
  - 当前主题模式（light / dark / auto）
  - 是否命中了旧的后台壳文件或旧静态资源
  - 页面真实 DOM 与最终命中的 CSS
- 用浏览器 MCP 验证完成后，如果本次注入的 token、缓存或站点存储可能影响后续排查，记得清理当前 origin 的临时状态
- 如果代码已经修改，为避免容器残留状态影响判断，Docker 验证仍应优先使用全量重启：

```bash
VANBLOG_HTTP_PORT=18080 docker compose down
VANBLOG_HTTP_PORT=18080 docker compose up -d --build
```
