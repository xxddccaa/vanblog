# 生产部署指南

这份文档面向需要把已经发布好的 VanBlog 多镜像部署到服务器的人类维护者和 AI 代理。

如果你要做的是“构建并发布镜像”，请看 `RELEASE.md`；如果你要做的是“把已经发布好的镜像部署到服务器”，请看这份文档。

当前代码基线已经推进到 `v1.5.4`，生产部署文档也统一以 `kevinchina/deeplearning` 这套长期保留镜像仓库为准。

## 1. 部署矩阵

当前建议把部署方式理解成三层：源码构建、latest 快速部署、版本锁定部署。AI 工作台则是在这些基础上按需叠加。

| 目标 | 推荐文件 | 适用情况 |
| --- | --- | --- |
| 本地开发 / 改代码 | `docker-compose.yml` | 从源码构建，适合调试与联调 |
| latest 快速部署 | `docker-compose.latest.yml` | 不想维护 `.env`，直接拉取 `latest` 主栈 |
| 一份文件直接带 AI | `docker-compose.latest.ai.yml` | 想用一份 compose 同时拉起主栈和 bundled FastGPT |
| 锁定某个正式版本 | `docker-compose.image.yml` + `.env.release.example` | 需要精确回滚、审计、复现线上版本 |
| 锁版 + 私有 FastGPT | `docker-compose.image.yml` + `docker-compose.ai-qa.yml` | 已有私有 FastGPT，只给 `server` 注入连接 |
| 锁版 + bundled FastGPT | `docker-compose.image.yml` + `docker-compose.ai-qa.yml` + `docker-compose.fastgpt.yml` | 同机部署完整 AI 工作台扩展 |

双轨说明：

- `docker-compose.latest.yml` / `docker-compose.latest.ai.yml` 适合快速部署、个人维护、先把服务跑起来
- `docker-compose.image.yml` + `.env.release.example` 适合正式发布、锁版、回滚、审计
- 两条路径都保留，不互相替代

如果你和我当前生产机目录一样，只想长期维护两份 quick-start 文件，也可以直接采用：

- `docker-compose.yaml`：你自己保存的 latest 主栈文件，不启用 AI
- `docker-compose.latest.ai.yml`：一份文件直接带 AI 工作台与 bundled FastGPT

这种目录下的实际操作就是：

```bash
# 主栈
docker compose pull
docker compose up -d

# AI 版
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

仓库里的 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml` 仍建议保留，因为它们负责锁版部署、只接私有 FastGPT、自动化测试和模块化排障；但如果你服务器上只走这两份 quick-start 文件，可以不把 override 文件放进生产目录。

## 2. 服务器准备

建议服务器至少具备：

- 已安装 Docker
- 已安装 `docker compose` 或 `docker-compose`
- 默认 HTTP 部署时已开放 80 端口
- 如果要启用内置 Caddy HTTPS，再额外开放 443 端口
- 有一组可持久化的数据目录

把仓库中的这些文件带到服务器：

- `docker-compose.latest.yml`
- `docker-compose.latest.ai.yml`（只有想一文件启用 AI 时需要）
- `docker-compose.image.yml`（只有想锁定具体版本时需要）
- `docker-compose.ai-qa.yml`（只有想启用 AI 工作台时需要）
- `docker-compose.fastgpt.yml`（只有想启用 bundled FastGPT 时需要）
- `docker-compose.https.yml`（只有想启用内置 HTTPS 时需要）
- `.env.release.example`
- 如有自定义配置，可额外带上自己的 `.env`

注意：

- 不要把 `postgres`、`redis` 单独映射到宿主机端口
- 不要把 Caddy admin API `2019` 暴露到公网
- 默认 HTTP-only 模式只需要暴露 `80`
- 如果叠加 `docker-compose.https.yml`，再额外暴露 `443`
- 默认官方拓扑会自动启用 `VANBLOG_WALINE_CONTROL_URL=http://waline:8361`，不需要再额外开放 Waline 端口
- 默认镜像拓扑会把共享 Waline JWT 落盘到日志目录中的 `waline.jwt`，因此不要删除该文件所在的数据卷，除非你明确知道会导致 Waline 登录态与控制令牌轮换

## 3. 如需锁版部署：生成服务器环境文件

先复制模板：

```bash
cp .env.release.example .env
```

然后至少修改这些内容：

- `EMAIL`：你的邮箱，用于证书相关场景
- `VANBLOG_DOCKER_REPO`：默认继续使用 `kevinchina/deeplearning`
- `VANBLOG_RELEASE_SUFFIX`：本次要部署的镜像版本，例如 `v1.5.4-<image-id>`
- `POSTGRES_PASSWORD`：建议不要继续使用示例值
- `VAN_BLOG_WALINE_DATABASE_URL`：Waline 独立 PostgreSQL 数据库连接串，默认是同实例下的 `waline` 数据库
- `WALINE_JWT_TOKEN`：可选；如需手动指定 Waline 与内部控制面共用密钥可填写，否则留空让系统首次启动时自动生成
- 目录挂载项：按你的服务器实际目录调整

如果 `WALINE_JWT_TOKEN` 留空，镜像运行时会在首次启动时自动生成一份共享密钥，并写入日志目录中的 `waline.jwt` 文件，后续重启会继续复用这份密钥。

可选但和本文这轮缓存改造直接相关的配置：

- `VAN_BLOG_CLOUDFLARE_API_TOKEN`
- `VAN_BLOG_CLOUDFLARE_ZONE_ID`

说明：

- 两个值都配置后，服务端才会在文章更新、RSS/sitemap/search-index 刷新后请求 Cloudflare tag/url purge。
- 如果留空，站点仍可运行，但 Cloudflare tag/url purge 不会启用，只能依赖边缘 TTL 自然过期。
- 这两个变量只会传给 `server` 容器，不需要暴露给 `website`、`admin`、`caddy`。
- URL purge 还依赖站点元数据里的 `siteInfo.baseUrl`。如果初始化或站点设置里没有填最终对外访问的完整公网地址，Cloudflare URL purge 会跳过。

## 4. 首次部署

### 4.1 latest 快速部署：主栈

如果你明确接受 `latest` 会随着后续发布移动，想直接使用当前目录映射与固定字段模板，可以：

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

这个模板的特点：

- 直接写死 `kevinchina/deeplearning:vanblog-*-latest`
- 继续使用当前目录下的 `./data`、`./log`、`./caddy` 等挂载路径
- 不需要额外准备 `.env`

### 4.2 latest 快速部署：一份文件直接带 AI

如果你还想把 AI 工作台和 bundled FastGPT 一起用“一份文件”拉起来，可以改用：

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

这份文件同样是 quick-start 风格：

- VanBlog 核心服务继续使用 `vanblog-*-latest`
- bundled FastGPT 继续固定到当前仓库验证过的版本矩阵，并改为从 `kevinchina/deeplearning` 备份标签拉取
- `fastgpt-app`、MinIO 等调试入口默认只绑定到 `127.0.0.1`
- 如需沿用你自己的宿主机 HTTP 端口，可通过 `VANBLOG_HTTP_PORT` 覆盖

但也请注意：

- 它更适合快速部署或个人维护场景
- 如果你希望上线内容可精确回滚、可审计，继续使用下一节的 `docker-compose.image.yml`

### 4.3 锁版部署：版本化镜像

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

说明：

- 官方 `waline` 容器会在首次启动时尝试确保 `waline` 数据库存在，默认使用 `POSTGRES_USER` / `POSTGRES_PASSWORD` 连接 PostgreSQL。
- 如果你改成了权限受限的数据库账号，导致容器无法自动建库，请手动补建 Waline 数据库，例如：

```bash
docker compose -f docker-compose.image.yml exec postgres \
  psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-vanblog} \
  -c 'CREATE DATABASE waline;'
```

查看状态：

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f caddy server website admin waline postgres redis
```

首次启动后，访问：

```text
http://<你的域名或 IP>/admin/init
```

按页面引导完成初始化。

初始化时请特别确认：

- `siteInfo.baseUrl` 填的是最终对外访问的完整公网地址，例如 `https://blog.example.com`

如果这里留空或填错：

- Cloudflare tag purge 仍可工作
- Cloudflare URL purge 会跳过
- RSS 中依赖站点域名的绝对链接也可能不完整

### 4.4 可选：启用内置 Caddy HTTPS

如果你不打算在外层再套自己的 Caddy / Nginx，而是希望直接使用 VanBlog 内置 Caddy 申请和管理证书，可改用：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

同时请确认：

- `.env` 中把 `VAN_BLOG_CADDY_MANAGE_HTTPS=true`
- 宿主机已开放 `80/443`
- 域名已经正确解析到当前服务器

这个附加文件会做两件事：

- 把内置 Caddy 切换到 `docker/caddy/Caddyfile.https`
- 让 `server` 容器允许后台管理 HTTPS 自动重定向

## 5. 可选：启用 AI 工作台 / FastGPT

这套能力是 `v1.4.0` 引入的可选扩展，不属于默认对外拓扑：

- 默认 `docker-compose.image.yml` 不会启动 FastGPT
- 默认 `docker-compose.yml` / `docker-compose.image.yml` 也不会给 `server` 注入 FastGPT 地址
- VanBlog 的公网入口仍然只走 `caddy` 的 `80/443`
- 不要把 FastGPT 通过 VanBlog 的 Caddy 公开暴露出去
- `VAN_BLOG_FASTGPT_INTERNAL_URL` 只应该指向内网地址、容器网络地址，或宿主机本地地址
- 如果你只是想部署博客主栈，可以完全忽略这一节

如果你希望看一份更完整的启用与后台操作清单，可以直接看 `docs/ai-qa-fastgpt.md`。

### 5.1 只连接已有私有 FastGPT

如果你已经有一套内网可达的 FastGPT，可以只在 `.env` 里配置：

```env
VAN_BLOG_FASTGPT_INTERNAL_URL=http://your-private-fastgpt:3000
# 如果希望 VanBlog admin 自动把 bundled/external FastGPT 的模型配置写进去，
# 还需要提供对应 FastGPT root 账号的登录密码
FASTGPT_ROOT_PASSWORD=replace-with-fastgpt-root-password
```

然后显式叠加 AI-QA override：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d
```

### 5.2 同机启用 bundled FastGPT

如果你想在同一台机器上一起启动仓库内提供的可选扩展，可以使用：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

如果同时启用了内置 HTTPS，可以继续叠加：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

这里两个 compose 文件的职责分别是：

- `docker-compose.ai-qa.yml`：只给 `server` 注入 AI 工作台所需的私有 FastGPT 地址
- `docker-compose.fastgpt.yml`：启动可选的 FastGPT 依赖服务本身，以及一个一次性的 `fastgpt-bootstrap`

如果你只是像我现在的生产目录一样保留 `docker-compose.yaml` 与 `docker-compose.latest.ai.yml` 两份文件，那么这里这两个 override 文件可以不用拷到线上；但仓库里不建议删除，因为锁版部署、测试与局部排障仍依赖它们。

如果你打算直接在 VanBlog 的 `/admin/ai` 页面里维护 bundled FastGPT 的上游模型配置，还需要让 `server` 拿到 FastGPT root 账号密码。当前 `docker-compose.ai-qa.yml` 会把宿主机环境变量 `FASTGPT_ROOT_PASSWORD` 注入到 `server` 容器里；VanBlog 会先用它登录 FastGPT root，再调用模型管理 API。同一个页面里的“测试模型”按钮会直接请求你填写的上游 `/chat/completions` 与 `/embeddings` 地址，因此即使没配 root 密码，也能先验证上游模型是否可用。

如果你使用的是仓库里这套 bundled FastGPT，`docker-compose.fastgpt.yml` 还会额外启动一个一次性的 `fastgpt-bootstrap`。它会在 `fastgpt-app` 与 `fastgpt-mongo` 就绪后自动检查 `team_subscriptions`，为旧数据卷里缺失的免费套餐记录补齐 `currentSubLevel` 等关键字段，避免 FastGPT 在创建 Dataset / App 时因为 `Cannot read properties of undefined (reading 'currentSubLevel')` 而失败。默认会补一条 30 天、100 points 的 free plan；如需调整，可以在 `.env` 里额外设置：

```env
FASTGPT_FREE_PLAN_POINTS=100
FASTGPT_FREE_PLAN_DURATION_DAYS=30
```

这份 `docker-compose.fastgpt.yml` 的约束是：

- `fastgpt-app` 默认只绑定到 `127.0.0.1:${FASTGPT_HTTP_PORT:-3100}`
- `server` 容器通过 `http://fastgpt-app:3000` 访问它
- Mongo / Vector / Redis 不增加公网 host 端口
- MinIO 也只绑定到 `127.0.0.1`，方便你按需本机调试
- 当前 bundled FastGPT 版本矩阵已经固定记录在 `docs/ai-qa-fastgpt.md`
- bundled FastGPT 默认沿用当前仓库验证过的版本，不主动跟进上游更新；只有在你明确决定升级 FastGPT 基线时，再重新验证并修改 compose

首次启用前，请先检查并按你的模型供应商改好：

- `docker/fastgpt/config.json`
- `docker/fastgpt/config.json.example`

### 5.3 后台使用方式

后台使用方式：

- AI 工作台入口是 `/admin/ai`
- 对所有管理员开放；旧入口只保留兼容跳转
- 页面分为 `博客问答`、`配置中心`、`OpenCode 终端`
- 管理员发起的会话会写入数据库，并在管理员之间共享历史
- AI 回答会优先参考已同步到 FastGPT 的博客内容；没有直接覆盖时，也会结合通用知识补充说明
- `OpenCode 终端` 复用现有 `server` 容器，不依赖 bundled FastGPT；默认工作目录是 `/workspace/vanblog`，终端 HOME 会持久化到 `./data/ai-terminal/home`
- 如果使用 bundled FastGPT，可以先在后台填写两组模型信息：
  - 对话模型：完整 `.../chat/completions` 调用地址、Token、模型名、调用 Key
  - 向量模型：完整 `.../embeddings` 调用地址、Token、模型名、调用 Key
- Token 可以留空；留空时不会自动携带 `Authorization: Bearer ...`
- 填好后可以直接在页面里执行“同步模型到 FastGPT”和“测试模型”
- 如果已经配置 `FASTGPT_ROOT_PASSWORD`，还可以直接点击“自动创建 Dataset / App / API Key”，让 VanBlog 自动创建或复用 FastGPT 资源并回填配置
- 如果你不想给 VanBlog root 密码，也可以继续在 FastGPT 里手工创建 Dataset / App / API Key，然后再回填到后台
- 然后执行一次全量同步，把文章、草稿、私密文档送入知识库
- 完整字段解释、提示词策略、当前 bundled 版本矩阵，统一参考 `docs/ai-qa-fastgpt.md`

## 6. 升级与回滚

### 6.1 latest 主栈升级

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

### 6.2 latest 一文件 + AI 升级

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

### 6.3 锁版部署升级

假设你已经发布了新镜像，只需要更新 `.env` 里的：

```env
VANBLOG_RELEASE_SUFFIX=v1.5.4-<image-id>
```

然后执行：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

如果你启用了内置 HTTPS，则把命令改成：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml pull
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

### 6.4 回滚

如果新版本有问题，把 `.env` 改回旧版本即可，例如：

```env
VANBLOG_RELEASE_SUFFIX=v0.99.0-a1b2c3d4
```

再执行：

```bash
docker compose -f docker-compose.image.yml up -d
```

如果你启用了内置 HTTPS，则把命令改成：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.https.yml up -d
```

如果只是 AI 相关能力不稳定，也可以先移除 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml`，把博客主栈继续保留在线。

## 7. 常见检查项

部署后建议至少检查这些地址：

- `http://<host>/`
- `http://<host>/admin`
- `http://<host>/api/ui/`
- `http://<host>/swagger` 应返回 `404`

建议进一步确认：

- `/admin` 不会跳到 `:3002`
- 后台 CSS / JS 能正常加载
- 前台首页能打开
- 文章页能正常访问
- 评论管理页能正常打开
- `/admin/ai` 只在你显式启用 AI 工作台时出现并可用
- Swagger 只在受信任网络或容器内可访问，不对公网暴露

## 8. AI 代理部署规则

如果 AI 代理要帮你部署，默认应遵守下面规则：

1. 优先读取 `README.md`、`RELEASE.md`、`DEPLOY.md`。
2. latest 快速部署与 image 锁版部署双轨并列，不要擅自删掉其中一条说明。
3. 使用锁版部署时，从 `.env.release.example` 生成服务器 `.env`。
4. 需要一文件快速启用 AI 时，使用 `docker-compose.latest.ai.yml`；需要精确锁版与回滚时，使用 `docker-compose.image.yml` 叠加 override。
5. 不要新增 `postgres`、`redis` 的宿主机端口映射。
6. 不要新增 Caddy admin API `2019` 的宿主机端口映射。
7. 默认只对外暴露 `80`；只有启用 `docker-compose.https.yml` 时才暴露 `443`。
8. 发布版本切换优先通过 `VANBLOG_RELEASE_SUFFIX` 完成。
9. FastGPT 只能走私网、容器网络或 localhost；不要通过 VanBlog 的 Caddy 公开暴露出去。
