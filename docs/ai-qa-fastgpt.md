# AI 工作台 / FastGPT 操作清单

这份文档描述 `v1.4.0` 开始引入的 AI 工作台，以及它与 FastGPT 的部署、配置、运维关系。

如果你只是想知道后台 `/admin/ai` 该先点什么、再填什么，建议先看：

- [AI 工作台使用指南](./guide/ai-workspace.md)

先记住四条核心原则：

- AI 工作台是**可选能力**，不会并入默认部署
- 默认 `docker-compose.yml` / `docker-compose.image.yml` 不会因为 AI 而改变已有行为
- AI 工作台后台入口是 `/admin/ai`，对**所有管理员**开放；旧入口只保留兼容跳转
- 管理员问答历史会写入数据库，并在管理员之间共享

## 1. 当前产品行为

当前 AI 工作台分成三个 tab：

- `博客问答`
  - 面向管理员提问、继续追问、查看历史、重命名和删除会话
  - 每条会话会落库，后续管理员可以继续打开同一条历史
- `配置中心`
  - 面向 FastGPT 连接、Dataset / App / API Key、bundled 模型接入与同步运维
- `OpenCode 终端`
  - 只在显式启用 AI overlay 时提供浏览器终端
  - 复用现有 `server` 容器，不新增独立 terminal service
  - `opencode`、`git`、`rg`、`python3`、`pip`、`tmux`、`bash` 已预装；provider / login / 首次配置需要进入终端后自行完成

当前回答策略不是“无引用就拒答”，而是：

- 优先参考已同步到 FastGPT 的博客知识
- 没有直接覆盖时，也允许结合通用知识补充说明
- 如果某段内容是补充判断，而不是博客原文，系统提示词会要求模型不要把补充内容说成博客里已有事实

当前内置系统提示词的核心意思是：

> 你是 VanBlog 的博客知识助手。请优先参考博客知识回答；知识库没有直接覆盖时，可以结合通用知识做必要补充，但要明确区分博客中明确提到的内容和基于常识的补充判断。

### 1.1 提示词现在怎么写

当前落地时可以把提示词理解成三层：

1. **系统角色层**：把模型限定为 VanBlog 的博客知识助手，要求先看博客知识，再决定是否补充通用知识。
2. **知识注入层**：FastGPT 检索出来的文章、草稿、私密文档片段会作为知识上下文进入本次问答。
3. **回答约束层**：如果答案里有通用知识补充，模型要显式区分“博客里明确写过”和“基于常识的补充判断”，避免把补充内容说成博客原文。

这和以前“无引用不作答”的策略不一样。现在的目标是让 AI 工作台更像“博客知识优先的研究助手”，而不是只能做严格封闭问答的检索框。

## 2. Compose 组件职责

这套能力分成两个独立的 compose override，再加一个一文件 quick-start：

- `docker-compose.ai-qa.yml`
  - 只给 `server` 注入 AI 工作台所需的 FastGPT 私有地址
  - 同时把 `FASTGPT_ROOT_PASSWORD` 注入 `server`
  - 同时启用浏览器终端，暴露 `7681`，并挂载当前部署目录到 `/workspace/vanblog`
  - 终端 HOME 会持久化到 `./data/ai-terminal/home`
  - 不会额外启动 FastGPT 容器
- `docker-compose.fastgpt.yml`
  - 启动 bundled FastGPT 及其依赖
  - 包含一次性的 `fastgpt-bootstrap`
  - `fastgpt-bootstrap` 会修复旧 FastGPT 数据卷里缺失的 free plan / `team_subscriptions` 记录，避免创建 Dataset / App 时因 `currentSubLevel` 缺失而失败
- `docker-compose.latest.ai.yml`
  - 把 latest 主栈和 bundled FastGPT 合成一份 compose
  - 适合快速体验，不适合精确锁版回滚

如果你服务器目录只想像我现在这样保留两份 quick-start 文件，那么线上实际上只需要：

- `docker-compose.yaml`：不带 AI 的 latest 主栈
- `docker-compose.latest.ai.yml`：一份文件直接带 AI

仓库里继续保留 `docker-compose.ai-qa.yml` 与 `docker-compose.fastgpt.yml`，主要是为了：

- 锁版部署时模块化叠加
- 只接已有私有 FastGPT
- 自动化测试与回归验证
- AI 故障时可以单独拆掉 override 排障

## 3. 启动方式

### 3.1 默认博客栈，不启用 AI

这是默认方式：

```bash
docker compose -f docker-compose.image.yml up -d
```

不需要 AI 的用户，到这里就够了。

### 3.2 使用已有私有 FastGPT

如果你已经有一套内网可达的 FastGPT，只需要启用 AI-QA override：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d
```

或源码调试环境：

```bash
docker compose -f docker-compose.yml -f docker-compose.ai-qa.yml up -d --build
```

### 3.3 使用仓库内 bundled FastGPT

如果想在同一台机器上把 bundled FastGPT 一起启动：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

或源码调试环境：

```bash
docker compose -f docker-compose.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d --build
```

### 3.4 一份文件直接带 AI

如果你只是想快速体验，而不是锁定某个正式版本，也可以直接使用：

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

这个文件会直接拉起：

- latest 版 VanBlog 主栈
- `fastgpt-app`
- `fastgpt-bootstrap`
- FastGPT 的 Mongo / Vector / Redis / MinIO / Plugin / AIProxy / Sandbox 依赖

## 4. 环境变量

最常用的是这几个：

```env
# 指向私有 FastGPT；如果和 bundled FastGPT 一起启动，默认值可直接使用
VAN_BLOG_FASTGPT_INTERNAL_URL=http://fastgpt-app:3000

# 让 VanBlog admin 可以登录 FastGPT root，并同步模型 / 自动创建资源
FASTGPT_ROOT_PASSWORD=replace-with-fastgpt-root-password

# 仅在你手工覆写 compose 时才需要；仓库自带 AI overlay 会直接把它设为 true
VANBLOG_AI_TERMINAL_ENABLED=true

# 仅 bundled FastGPT 使用；用于修复旧数据卷缺失 free plan 的情况
FASTGPT_FREE_PLAN_POINTS=100
FASTGPT_FREE_PLAN_DURATION_DAYS=30
```

说明：

- `VAN_BLOG_FASTGPT_INTERNAL_URL` 必须走私网、容器网络或 localhost，不要通过 VanBlog 的 Caddy 暴露到公网
- 不配置 `FASTGPT_ROOT_PASSWORD` 时，页面里的“测试模型”仍可用，但“同步模型到 FastGPT”“自动创建 Dataset / App / API Key”不可用
- `VANBLOG_AI_TERMINAL_ENABLED` 默认不应出现在主栈里；只有 `docker-compose.ai-qa.yml` / `docker-compose.latest.ai.yml` 这类显式 AI overlay 才会把它打开
- `FASTGPT_FREE_PLAN_POINTS` 与 `FASTGPT_FREE_PLAN_DURATION_DAYS` 只对 `docker-compose.fastgpt.yml` 里的 `fastgpt-bootstrap` 生效

## 5. Admin 页面操作顺序

后台入口：

```text
/admin/ai
```

推荐顺序如下。

### 5.1 先看 `配置中心`

常见字段解释：

- `Dataset ID`
  - FastGPT 里的知识库数据集 id
  - VanBlog 的文章 / 草稿 / 私密文档会同步到这个 Dataset 中
  - 如果后续更换 embedding 模型，通常需要新建或重建 Dataset
- `App ID`
  - FastGPT 里的应用 / 工作流 id
  - AI 工作台聊天时最终会调用这个 App
- `API Key`
  - FastGPT App 的访问密钥
  - 当前后台会按 `apiKey-appId` 形式组装聊天鉴权
- `Query Extension`
  - 对应 `datasetSearchUsingExtensionQuery`
  - 会在检索前先扩写问题，提升召回率，但会增加一点延迟，也可能带来更多噪声
- `Rerank`
  - 对召回结果做二次排序，通常能改善相关性，但也会增加一定耗时

### 5.2 填写 bundled 模型信息

如果你要让 VanBlog 代管 bundled FastGPT 的模型配置，页面会分成两组模型：

- 对话模型
  - 模型名
  - 调用 Key
  - 调用地址：填写完整 `.../chat/completions`
  - Token：可留空
- 向量模型
  - 模型名
  - 调用 Key
  - 调用地址：填写完整 `.../embeddings`
  - Token：可留空

说明：

- 这里要求的是完整 OpenAI-compatible 上游地址，不是 base URL
- Token 留空时，不会自动发送 `Authorization: Bearer ...`

### 5.3 测试模型

点击：

- `测试模型`

它会直接请求你填写的上游：

- 对话模型：`/chat/completions`
- 向量模型：`/embeddings`

这一步不依赖 `FASTGPT_ROOT_PASSWORD`。

### 5.4 同步模型到 FastGPT

点击：

- `同步模型到 FastGPT`

这一步会把页面里填写的 bundled 模型配置写入 FastGPT，因此要求 `server` 已注入 `FASTGPT_ROOT_PASSWORD`。

### 5.5 自动创建 Dataset / App / API Key

点击：

- `自动创建 Dataset / App / API Key`

当前实现会尽量复用已有配置：

- 已有 `Dataset ID` 且可用时优先复用
- 已有 `App ID` 时优先更新 App 工作流
- 已有 `API Key` 且 `App ID` 未变化时优先复用

### 5.6 全量同步知识

点击：

- `全量同步`

它会把 VanBlog 当前允许进入知识库的内容同步到 FastGPT，包括：

- 文章
- 草稿
- 私密文档

### 5.7 回到 `博客问答`

问答区当前的工作方式是：

- 围绕博客知识发问、继续追问、回看证据
- 管理员发起的会话会自动写入数据库
- 历史会话支持继续打开、重命名、删除
- 由于回答不再受“无引用拒答”限制，所以这里更适合作为“博客知识优先”的工作台，而不是绝对封闭的知识库检索器

### 5.8 可选：进入 `OpenCode 终端`

如果当前部署已经叠加了 `docker-compose.ai-qa.yml`，或直接使用 `docker-compose.latest.ai.yml`，`/admin/ai` 还会多一个 `OpenCode 终端` tab：

- 浏览器会先通过后台接口签发一个只作用于 `/admin/ai-terminal` 路径前缀的 HttpOnly cookie
- Caddy 再用 `forward_auth` 校验这个 cookie，然后把流量转发到 `server:7681`
- 终端默认工作目录是 `/workspace/vanblog`
- 终端 HOME 是 `/app/ai-terminal-home`，默认会映射到宿主机的 `./data/ai-terminal/home`
- `opencode` 已安装，但 provider / login / 首次配置需要你进入终端后自己完成

## 6. 只需要 chat 吗，需要 embeddings 吗

这两个接口的职责不一样：

- **只聊天，不重建知识库**：理论上只需要 FastGPT App 最终可用的聊天链路
- **想让 VanBlog 后台维护知识库**：需要同时有 `/chat/completions` 和 `/embeddings`

实际落地里，建议把两者都配上，因为当前后台能力不只是聊天，还包括：

- 测试对话模型
- 测试向量模型
- 同步 bundled FastGPT 模型
- 自动创建 Dataset / App / API Key
- 执行全量同步，把博客内容重新做 embedding 并写入知识库

简单说：

- `/chat/completions` 决定“怎么回答”
- `/embeddings` 决定“怎么把文章、草稿、私密文档变成可检索向量”

如果没有 `/embeddings`，你仍可能调用已有 FastGPT App 聊天，但一旦需要创建 Dataset、重建知识库、切换向量模型或重新同步内容，就会卡住。

## 7. 当前 bundled FastGPT 固化版本

当前仓库 `docker-compose.fastgpt.yml` / `docker-compose.latest.ai.yml` 已固定到下面这组验证过、并备份到 `kevinchina/deeplearning` 的版本：

| 服务         | 镜像                                                    |
| ------------ | ------------------------------------------------------- |
| FastGPT App  | `kevinchina/deeplearning:fastgpt-v4.14.10.2`            |
| Code Sandbox | `kevinchina/deeplearning:fastgpt-code-sandbox-v4.14.10` |
| Plugin       | `kevinchina/deeplearning:fastgpt-plugin-v0.5.6`         |
| AIProxy      | `kevinchina/deeplearning:aiproxy-v0.3.5`                |
| Vector PG    | `pgvector/pgvector:0.8.0-pg15`                          |
| AIProxy PG   | `pgvector/pgvector:0.8.0-pg15`                          |
| Mongo        | `mongo:5.0.32`                                          |
| Redis        | `redis:7.2-alpine`                                      |
| MinIO        | `minio/minio:RELEASE.2025-09-07T16-13-09Z`              |
| Bootstrap    | `mongo:5.0.32`                                          |

这组版本的含义是：

- 当前仓库已经按这一组 tag 做过联调与页面接入
- `pnpm release:images` / `pnpm release:images:push` **不会**发布这些 FastGPT 镜像
- 这 4 个关键 FastGPT 镜像现在已经直接改成从 `kevinchina/deeplearning` 备份标签拉取，避免生产目录继续直接依赖上游 GHCR
- 当前默认策略是“固定这套已验证版本，不主动追着上游 FastGPT 更新跑”

## 8. 运维检查

### 8.1 查看容器状态

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml ps
```

源码调试环境把 `docker-compose.image.yml` 改成 `docker-compose.yml` 即可。

### 8.2 查看关键日志

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml \
  logs -f server fastgpt-app fastgpt-bootstrap
```

重点关注：

- `server`：AI 工作台接口报错、同步报错、FastGPT 调用报错
- `fastgpt-app`：Dataset / App / OpenAPI key 创建异常
- `fastgpt-bootstrap`：旧数据卷 free plan 修复结果

如果 `fastgpt-bootstrap` 正常，会看到类似：

```text
teams: 1
inserted: 0
repaired: 0
```

## 9. 常见注意事项

### 9.1 旧 FastGPT 数据卷报 `currentSubLevel`

如果 FastGPT 在创建 Dataset / App 时出现：

```text
Cannot read properties of undefined (reading 'currentSubLevel')
```

通常表示旧数据卷里缺少 `team_subscriptions` 的免费套餐记录。

如果你使用的是仓库内 bundled FastGPT，`fastgpt-bootstrap` 会自动修复；不需要手工改 Mongo。

### 9.2 更换 embedding 模型

向量模型只会影响之后新建或重建的 Dataset。

如果已经创建过 Dataset，再更换 embedding 模型，通常应按下面顺序处理：

1. 新建 Dataset
2. 更新 App
3. 重新全量同步

### 9.3 不想给 root 密码

如果不希望 VanBlog 持有 `FASTGPT_ROOT_PASSWORD`，也可以：

1. 只在页面里测试上游模型
2. 在 FastGPT 里手工创建 Dataset / App / API Key
3. 把 `Dataset ID` / `App ID` / `API Key` 回填到后台

这种方式仍能正常使用 AI 工作台，只是少了 bundled 模型同步和自动建资源能力。
