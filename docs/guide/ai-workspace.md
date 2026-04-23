---
title: AI 工作台使用指南
icon: robot
order: 5
---

# AI 工作台使用指南

这篇文档只讲一件事：普通站长如何把 `/admin/ai` 配起来并开始使用。

如果你想看部署、compose 组合、bundled FastGPT 结构、排障或运维说明，请看：

- [AI 工作台 / FastGPT 操作清单](../ai-qa-fastgpt.md)

## 先知道入口在哪

打开后台：

```text
http://你的域名/admin/ai
```

页面主要分成三个标签：

- `博客问答`：配置完成后，在这里直接提问、继续追问、查看共享历史
- `配置中心`：按步骤填写模型接口、FastGPT 资源和同步设置
- `OpenCode 终端`：可选的浏览器终端入口；只有显式叠加 AI overlay 时才会启用

建议第一次使用时，先只看 `配置中心`。

## 你要先准备什么

至少准备好下面这些信息：

### 1. 对话模型接口

也就是兼容 OpenAI 的 chat 接口，通常要准备：

- 完整请求地址，且以 `/chat/completions` 结尾
- 这个模型的 `model` 标识
- 对应的 Bearer Token（如果上游要求鉴权）

### 2. 向量模型接口

也就是 embedding 接口，通常要准备：

- 完整请求地址，且以 `/embeddings` 结尾
- 这个模型的 `model` 标识
- 对应的 Bearer Token（如果上游要求鉴权）

### 3. FastGPT 资源信息

你最终需要这 3 个值：

- `Dataset ID`
- `App ID`
- `API Key`

这 3 个值有两种来源：

- 你自己在 FastGPT 里手工创建
- 用 bundled FastGPT 时，由 VanBlog 自动创建

## 推荐操作顺序

进入 `/admin/ai` 后，请严格按页面里的 1 → 4 操作。

## 第 1 步：填写模型接口

在 `配置中心` 里，先填写两组模型：

### 对话模型

- `展示名`：给自己看，方便识别
- `调用 Key`：上游要求的 model 名
- `调用地址`：完整 chat 地址
- `Token`：如果接口要求鉴权就填写

### 向量模型

- `展示名`
- `调用 Key`
- `调用地址`
- `Token`

注意：

- 页面不会回显已经保存过的 Token
- 留空表示沿用之前已保存的值
- 只有输入新值时才会覆盖

## 第 2 步：点击“测试模型”

填完后，先点：

- `测试模型`

这一步只是确认你填写的 chat / embeddings 接口能不能正常返回。

如果测试失败，不要急着往下做，先回到第 1 步检查：

- 地址是否完整
- 是否填成了正确的 `/chat/completions` 或 `/embeddings`
- `model` 值是否正确
- Token 是否正确

## 第 3 步：写入 FastGPT

如果你使用的是 bundled FastGPT，并且部署里已经注入了 FastGPT root 密码，就可以做这一步。

页面里通常会用两个按钮：

- `同步模型到 FastGPT`
- `自动创建资源`

建议顺序：

1. 先点 `同步模型到 FastGPT`
2. 再点 `自动创建资源`

这样 VanBlog 会把当前页面填写的模型同步到 FastGPT，并自动创建或复用：

- Dataset
- App
- API Key

如果你不是 bundled FastGPT 用户，而是自己独立管理 FastGPT，那么这一步可以跳过，改成手工把 `Dataset ID / App ID / API Key` 填到第 4 步里。

## 第 4 步：保存配置并同步知识

这一步会做两件事：

1. 保存当前问答配置
2. 把博客内容写入知识库

建议顺序：

1. 点 `保存配置`
2. 再点 `全量同步`

你需要确认这些值已经就绪：

- `Dataset ID`
- `App ID`
- `API Key`

如果你刚才使用了自动创建资源，这些值通常会自动出现。

如果你是手工管理 FastGPT，请把自己的资源 ID 和 Key 填进去再保存。

## 检索设置怎么填

大多数人先用默认值就可以，不建议一开始就调很多参数。

推荐起步：

- `检索模式`：`mixedRecall`
- `最大 Token 限额`：保持默认
- `最小相似度`：保持默认
- `启用 Rerank`：先按默认

`Query Extension` 也建议先不要折腾，只有在你博客里术语、缩写、专有名词特别多时，再回来启用。

## 什么时候算配置成功

当你看到下面几项都正常时，基本就可以开始用了：

- 模型测试通过
- `Dataset ID / App ID / API Key` 已经有值
- 已保存配置
- 已执行过一次 `全量同步`

## 然后去哪里用

切换到 `/admin/ai` 的 `博客问答` 标签。

你现在可以直接提问，例如：

- 帮我总结一下这个博客最近主要写了哪些内容
- 我有哪些草稿适合整理成正式文章
- 这个博客里提到过哪些和某个关键词相关的内容
- 根据我现有的文章内容，接下来还可以补哪些主题

管理员发起的会话会保存到数据库里，其他管理员也能继续追问同一条历史。

## 可选：什么时候会看到 `OpenCode 终端`

只有在部署里显式叠加 `docker-compose.ai-qa.yml`，或直接使用 `docker-compose.latest.ai.yml` 时，这个标签才会真正可用。

进入后你会得到一个浏览器内终端：

- 默认工作目录：`/workspace/vanblog`
- 默认 HOME：`/app/ai-terminal-home`
- 已预装：`opencode`、`git`、`rg`、`python3`、`pip`、`tmux`、`bash`

注意：

- 这个终端复用现有 `server` 容器，不会新增独立 terminal service
- `opencode` 已安装，但 provider / login / 首次配置需要你在终端里自己完成
- OpenCode 的本地配置、缓存和 shell 历史会默认持久化到宿主机的 `./data/ai-terminal/home`

## 常见分支：我是 bundled FastGPT 还是手工 FastGPT？

可以这样理解：

### bundled FastGPT

适合：

- 你直接用了仓库里的 AI compose 文件
- 想让 VanBlog 帮你同步模型、创建资源

你的常见路径是：

1. 填模型接口
2. 测试模型
3. 同步模型到 FastGPT
4. 自动创建资源
5. 保存配置
6. 全量同步

### 手工管理 FastGPT

适合：

- 你已经有自己的 FastGPT
- 你想自己管理模型、知识库、应用和 Key

你的常见路径是：

1. 填模型接口
2. 测试模型
3. 手工准备 `Dataset ID / App ID / API Key`
4. 填回 VanBlog 页面
5. 保存配置
6. 全量同步

## 如果报错，先看哪几项

先看页面左侧状态卡片，重点检查：

- `FastGPT 内部地址`
- `FastGPT root 密码`
- `bundled 模型`
- `Dataset ID`
- `App ID`
- `最近全量同步`

常见判断方法：

- 模型测试失败：通常是上游接口地址、model、Token 填错
- 无法同步模型到 FastGPT：通常是 root 密码没注入或不正确
- 提示缺少 `datasetId/appId/apiKey`：说明资源还没创建好，或者还没填回配置
- 问答结果不理想：先确认有没有做过一次全量同步

## 不想研究参数，只想尽快用起来

那就照这个最短流程做：

1. 打开 `/admin/ai`
2. 在 `配置中心` 填 chat 和 embeddings
3. 点 `测试模型`
4. 如果你用 bundled FastGPT，就点 `同步模型到 FastGPT` 和 `自动创建资源`
5. 点 `保存配置`
6. 点 `全量同步`
7. 切到 `博客问答` 开始提问

如果你走到第 4 步时已经拿到了 `Dataset ID / App ID / API Key`，这套能力就基本串起来了。
