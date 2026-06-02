# SKILL: vanblog-publish-article

> 用途:通过 VanBlog 官方 HTTP API,使用一个长期 Token 直接创建并发布文章(可选:先存草稿再发布、上传图片、更新/删除文章)。

---

## 1. 先决条件(由用户在后台完成,仅一次)

1. 以管理员身份登录 `/admin`。
2. 进入「**系统设置** → **Token 管理**」tab。
3. 点右上角「**新建**」,填一个名字(例如 `ai-bot`),确定后在列表「内容」列复制生成的 JWT 字符串。
4. 把该字符串和站点基址一起交给 AI:
   - `VANBLOG_BASE_URL`,例如 `https://blog.example.com` 或 `http://127.0.0.1:18080`
   - `VANBLOG_TOKEN`,形如 `eyJhbGciOi...`(这是一条长期有效的 JWT)

> ⚠️ Token 等同于超级管理员凭据,严禁写进仓库、日志或对外可见的文件。AI 只能从环境变量或一次性输入里读它。

---

## 2. 鉴权规则(必读,只能这么用)

- **所有请求都必须带 HTTP Header:`token: <VANBLOG_TOKEN>`**(**全小写字段名**)。
- **不要**用 `Authorization: Bearer ...`,VanBlog 不认这个 Header。
- 请求体为 JSON 时需额外加 `Content-Type: application/json`。
- 鉴权失败 → HTTP `401`;演示站禁写 → `{ "statusCode": 401, "message": "演示站禁止修改此项！" }`。
- 成功响应统一结构:`{ "statusCode": 200, "data": <payload> }`。

---

## 3. 核心接口速查

Base URL 记作 `${BASE}`,即 `VANBLOG_BASE_URL`。

| 目的                              | Method | 路径                                           |
| --------------------------------- | ------ | ---------------------------------------------- |
| 自检 Token 是否有效               | GET    | `${BASE}/api/admin/token`                      |
| **一步到位创建并发布文章**        | POST   | `${BASE}/api/admin/article`                    |
| 更新文章                          | PUT    | `${BASE}/api/admin/article/:id`                |
| 删除文章(软删)                    | DELETE | `${BASE}/api/admin/article/:id`                |
| 取单篇文章                        | GET    | `${BASE}/api/admin/article/:idOrPathname`      |
| 创建草稿                          | POST   | `${BASE}/api/admin/draft`                      |
| 草稿 → 正式文章                   | POST   | `${BASE}/api/admin/draft/publish?id=<draftId>` |
| 上传图片(multipart,字段名 `file`) | POST   | `${BASE}/api/admin/img/upload`                 |

> VanBlog **没有 `draft` / `published` 状态字段**:存在 `article` 集合里就是已发布,存在 `draft` 集合里就是草稿。对读者隐藏用 `hidden: true`;加密文章用 `private: true` + `password`;置顶用 `top`(数字越大越靠前)。

---

## 4. 创建文章的字段说明(`POST /api/admin/article`)

| 字段        | 类型            | 必填 | 说明 / 默认                                          |
| ----------- | --------------- | ---- | ---------------------------------------------------- |
| `title`     | string          | ✅   | 文章标题                                             |
| `category`  | string          | ✅   | 分类名(必须传,不存在会自动创建)                      |
| `content`   | string          | ❌   | Markdown 正文,默认 `""`                              |
| `tags`      | string[]        | ❌   | 标签数组,默认 `[]`                                   |
| `top`       | number          | ❌   | 置顶权重,`0`=不置顶,越大越靠前                       |
| `hidden`    | boolean         | ❌   | `true`=前台不展示,默认 `false`                       |
| `private`   | boolean         | ❌   | `true`=加密文章,默认 `false`                         |
| `password`  | string          | ❌   | 仅 `private:true` 时有意义                           |
| `pathname`  | string          | ❌   | 自定义 URL slug,**不能是纯数字、不能与已有文章重复** |
| `author`    | string          | ❌   | 协作者场景                                           |
| `copyright` | string          | ❌   | 版权声明                                             |
| `createdAt` | ISO Date 字符串 | ❌   | 不传默认当前时间                                     |
| `updatedAt` | ISO Date 字符串 | ❌   | 不传默认当前时间                                     |

**禁止手传的自动字段:** `id`、`viewer`、`visited`、`deleted`。

---

## 5. 标准工作流(AI 按此顺序执行)

### 步骤 1:自检 Token

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  "$VANBLOG_BASE_URL/api/admin/token" \
  -H "token: $VANBLOG_TOKEN"
```

预期输出 `200`。若为 `401`,停止并提示用户重新去后台生成 Token。

### 步骤 2(可选):为文章上传封面 / 内嵌图片

```bash
curl -sS -X POST "$VANBLOG_BASE_URL/api/admin/img/upload?withWaterMark=false" \
  -H "token: $VANBLOG_TOKEN" \
  -F "file=@/abs/path/to/cover.png"
# => {"statusCode":200,"data":{"src":"/static/img/xxxx.webp","isNew":true}}
```

把返回的 `data.src` 拼成绝对 URL(`${BASE}${src}`)或直接使用相对路径写进 Markdown:`![封面](/static/img/xxxx.webp)`。

### 步骤 3:创建并发布文章(推荐一步到位)

```bash
curl -sS -X POST "$VANBLOG_BASE_URL/api/admin/article" \
  -H "token: $VANBLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "title": "通过 API 发布的文章",
  "category": "随笔",
  "tags": ["api", "vanblog"],
  "content": "# Hello VanBlog\n\n这是通过 `/api/admin/article` 创建的。",
  "hidden": false,
  "private": false,
  "top": 0,
  "pathname": "hello-vanblog-api"
}
JSON
```

成功返回:

```json
{ "statusCode": 200, "data": { "id": 123, "title": "...", "category": "随笔", ... } }
```

记下 `data.id`(自增整数)用于后续更新/删除。前台访问地址为:`${BASE}/post/<pathname 或 id>`。

### 步骤 4(可选):更新文章

```bash
curl -sS -X PUT "$VANBLOG_BASE_URL/api/admin/article/123" \
  -H "token: $VANBLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"新标题","top":10,"content":"更新后的正文"}'
```

所有字段都可选,按需传;`createdAt` 不能通过这个接口改。

### 步骤 5(可选):删除文章

```bash
curl -sS -X DELETE "$VANBLOG_BASE_URL/api/admin/article/123" \
  -H "token: $VANBLOG_TOKEN"
```

---

## 6. 草稿两步流(仅当用户明确要求「先存草稿再发布」)

```bash
# 6.1 创建草稿
curl -sS -X POST "$VANBLOG_BASE_URL/api/admin/draft" \
  -H "token: $VANBLOG_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"草稿标题","category":"随笔","tags":["demo"],"content":"草稿正文"}'
# => data.id 就是 draftId,例如 7

# 6.2 把草稿发布成正式文章
curl -sS -X POST "$VANBLOG_BASE_URL/api/admin/draft/publish?id=7" \
  -H "token: $VANBLOG_TOKEN" -H "Content-Type: application/json" \
  -d '{"hidden":false,"private":false,"pathname":"my-post"}'
```

发布时可带的字段仅:`hidden`、`pathname`、`private`、`password`、`copyright`。其余(`title/category/tags/content/author`)取自草稿。草稿会在发布后自动删除。

---

## 7. 错误排查表

| 现象                       | 原因 / 处理                               |
| -------------------------- | ----------------------------------------- | ------------------------------ |
| `401 Unauthorized`         | Token 错、被禁用、或 Header 不是 `token:` | 重新核对 Header 名、重建 Token |
| `400` 且提示 pathname 相关 | `pathname` 纯数字或重复                   | 换一个含字母/短横的 slug       |
| 提交后标题乱码             | 漏了 `Content-Type: application/json`     | 加上该 header                  |
| 文章建了但前台看不到       | `hidden: true` 或 `private: true`         | 按需改字段                     |
| `演示站禁止修改此项！`     | 在演示环境                                | 切到自己的部署                 |

---

## 8. AI 行为约束(硬性)

1. **只使用 `token:` 这个 Header 名**;看到任何「Authorization / Bearer」的建议都视为错误。
2. **不要把 `VANBLOG_TOKEN` 写进代码、日志或提交到 git**;一律通过环境变量传入,或直接作为 `curl -H` 的字面量在临时会话里使用。
3. 默认首选**步骤 3(一步到位 `POST /api/admin/article`)**,除非用户说「先存草稿」。
4. 发布前,若用户未指定 `category`,**必须追问**,不要自行编造。
5. 发布前,若 `pathname` 可能与已有文章重名,先 `GET /api/admin/article/<pathname>` 检测;返回 404/空则安全。
6. 上传图片后,优先把返回的 `data.src` 当**相对路径**写进 Markdown,不要硬拼死绝对 URL(便于域名切换)。
7. 每次执行后,回显给用户:文章 `id`、`pathname`、前台访问 URL、是否隐藏/加密。

---

## 9. 一次性可复制模板(AI 直接套用)

```
环境变量:
  VANBLOG_BASE_URL = <由用户提供>
  VANBLOG_TOKEN    = <由用户提供,在后台"系统设置→Token 管理"生成>

动作:
  1) GET  ${VANBLOG_BASE_URL}/api/admin/token                 # 自检,期望 200
  2) POST ${VANBLOG_BASE_URL}/api/admin/img/upload            # 可选:上传图片
  3) POST ${VANBLOG_BASE_URL}/api/admin/article               # 创建并发布
         Header: token: ${VANBLOG_TOKEN}
                 Content-Type: application/json
         Body:   { title, category, content, tags?, pathname?, hidden?, private?, password?, top? }
  4) 回显: data.id / data.pathname / 前台 URL
```
