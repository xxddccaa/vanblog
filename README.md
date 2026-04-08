
<p align="center">
	VanBlog 是一款功能强大、易于使用的个人博客系统，支持全自动按需申请 HTTPS 证书、黑暗模式、移动端自适应以及评论功能。它内置了流量统计和图床，并集成了评论系统。此外，VanBlog 还具有无限的可扩展性，提供完备的后台管理面板，支持黑暗模式、移动端、一键上传剪贴板图片到图床，并带有强大的编辑器。
</p>


## 介绍

原项目地址： https://github.com/Mereithhh/vanblog

原项目协议：GPL-3.0 协议

二次开发继承协议：GPL-3.0 协议

二次开发说明：优化一些我自己认为不好使用的点，自己动手，丰衣足食啊。

我的博客地址： https://www.dong-blog.fun/


## vanblog二开群

可以进群提BUG或者功能点：

![image.png](img/qrcode_1749457934178.jpg)

## 我的二次开发进展内容

本项目基于 VanBlog 进行二次开发，主要进行了以下优化（只适应于我自己）:

- ✅ 使用Docker Compose一键启动启动项目
- ✅ 关闭Caddy的自动获取证书，使用Caddyfile而不是caddy json
- ✅ 文章标题显示完整，不再截断
- ✅ 不再显示网站运行时间和PowerBy的字样
- ✅ 默认关闭评论系统

和评论系统有关的位置的代码：
- 文件: packages/website/utils/getLayoutProps.ts
- 文件: packages/server/src/controller/admin/meta/meta.controller.ts
- 文件: packages/server/src/provider/analysis/analysis.provider.ts
- 文件: packages/admin/src/components/SiteInfoForm/index.tsx

- ✅ admin静态网页的Dockerfile地址写为https://registry.npmmirror.com
- ✅ 后台看文章列表的宽度显示进行优化，文章标题不省略显示，标题栏和标签栏均可换行显示

和宽度显示有关的代码：
- packages/admin/src/pages/Article/columns.jsx - 文章管理
- packages/admin/src/pages/Draft/columes.jsx - 草稿管理

- ✅ 移除对外部api依赖，版本对我来说不重要，直接修改此文件：packages/server/src/utils/getVersion.ts
- ✅ 这个分支本身是修复了Mermaid了的，现在Mermaid是可以正常使用的
- ✅ amdin后台每页显示的文章数量默认改为200

与每页显示多少文章有关的代码：
- packages/admin/src/pages/Article/index.jsx - 文章管理页面
- packages/admin/src/pages/Draft/index.jsx - 草稿管理页面

- ✅ 我习惯打开显示分类导航栏，但我的分类太多的时候，前端第二行不会换行显示。我更改了这一点。控制代码在`packages/website/components/NavBar/index.tsx` , 移除固定高度限制, 添加换行支持, 优化间距

- ✅ 我作为admin人员，在后台登录过，那么查看文章无需输入密码
- ✅ 前端代码块最多显示15行，增加展开代码和收起代码的按钮功能
- ✅ 添加智能代码块功能，记住用户上次使用的编程语言
- ✅ 禁用KaTeX严格模式以支持LaTeX公式中的Unicode字符
- ✅ mermaid渲染，在白色主题和暗色主题下都镜像修改配色。
- ✅ 增加个人动态页面。自行增加/moment页面即可。
- ✅ 为分类管理添加排序功能。
- ✅ 添加首页文章数量自定义设置功能。
- ✅ 添加浏览量管理功能。以前还有人炫自建博客浏览量，数据嘛，还不是想改就改，484~。
- ✅ admin数据看板优化。
- ✅ 联系方式重构，可以自定义上传联系方式图标并进行显示。
- ✅ add：轻量导航应用。
- ✅ add：使用AI为文章打标。
- ✅ 重构标签获取机制，重构一些加载机制从而加速。
- ✅ 优化博客的渲染机制。
- ✅ feat: 新增动画效果配置页面，优化粒子和心形爆炸动画
- ✅ feat: 新增音乐模块
- ✅ feat: 添加全站隐私设置功能
- ✅ feat: admin登录页面显示备案信息
- ✅ feat: admin增加私密文档功能，私密文档可以和草稿互相转换
- ✅ feat: admin增加搜索，在文章、草稿、私密文档都可以搜索
- ✅ Fix：修复了waline评论系统，可以看这里的文章：https://www.dong-blog.fun/post/2245

## 原项目特性

- **极致的响应速度**：Lighthouse 接近满分，性能卓越。
- **全自动 HTTPS 支持**：无需手动配置域名，即可实现按需申请 HTTPS 证书。
- **完整的前后端和服务端**：从前端到后端，再到服务端，全部集成。
- **响应式设计**：前台和后台都为响应式设计，完美适配移动端和多尺寸设备。
- **黑暗模式支持**：前台和后台均支持黑暗模式，并可自动切换。
- **静态网页（SSG）**：前台为静态网页，支持秒级的增量渲染。
- **SEO 和无障碍友好**：支持自定义文章路径，提升搜索引擎优化和无障碍体验。
- **内置分析功能**：可统计访客等数据，帮助您了解访问情况。
- **内嵌评论系统**：支持用户评论，增强互动性。
- **强大的 Markdown 编辑器**：支持多种功能，提升内容创作效率。
- **内置图床**：支持多种图床配置，方便图片管理。
- **图片处理**：支持图片水印和压缩，提升用户体验。
- **脚本一键部署**：支持 ARM 平台，简化部署流程。



## 整体架构

当前仓库已经从“Caddy + 前后端糅合到一个容器”的方式，拆分为 **Docker Compose 多容器架构**：

- **caddy**：统一对外入口，负责 `/`、`/admin`、`/api`、评论等路由转发
- **server**：NestJS 后端 API、Swagger、静态资源、公开接口
- **website**：Next.js 前台站点
- **admin**：Umi 构建后的后台静态页面，固定挂载在 `/admin/`
- **waline**：评论服务
- **mongo**：数据库，仅在 compose 内部网络可访问

### 路由与安全约束

当前默认的对外访问方式：

- 前台首页：`http://<你的 IP 或域名>/`
- 后台管理：`http://<你的 IP 或域名>/admin`
- API 文档：`http://<你的 IP 或域名>/swagger`
- 评论前台：`http://<你的 IP 或域名>/comment/`

安全设计上有两个默认约束：

- `mongo` **不暴露**到宿主机，避免被直接扫端口或爆破
- Caddy admin API `2019` **不暴露**到宿主机，仅允许内部服务调用

### 目录结构

当前关键目录结构如下：

```bash
├── docker                  # 多服务 Dockerfile、Caddyfile、运行脚本
├── docker-compose.yml      # 多容器编排入口
├── docs                    # 项目文档
├── packages                # 代码主体
│   ├── admin               # 后台前端代码
│   ├── cli                 # 小工具
│   ├── server              # 后端代码
│   ├── waline              # 评论服务包装
│   └── website             # 前台前端代码
├── tests                   # compose 部署与博客流程测试
├── README.md
└── pnpm-workspace.yaml
```

### 技术栈

- **前台**：[Next.js](https://nextjs.org/)、[React.js](https://reactjs.org/)、[Tailwind CSS](https://tailwindcss.com/)
- **后台**：[Ant Design Pro](https://pro.ant.design/zh-CN/)、[Ant Design](https://ant.design/)
- **后端**：[NestJS](https://nestjs.com/)、[MongoDB](https://www.mongodb.com/)
- **网关与编排**：[Caddy](https://caddyserver.com/)、[Docker Compose](https://docs.docker.com/compose/)
- **文档**：[VuePress](https://vuejs.press/zh/)、[VuePress Theme Hope](https://theme-hope.vuejs.press/zh/)

## 启动整个项目

### 启动方式 1：直接使用仓库内置编排启动

```bash
git clone https://github.com/xxddccaa/vanblog.git
cd vanblog
docker compose up -d --build
docker compose logs -f caddy server website admin waline mongo
```

首次启动后，请打开：

- `http://<你的 IP 或域名>/admin/init`

根据页面提示完成初始化。

停止服务：

```bash
docker compose down
```

如需连数据一起删除（谨慎使用）：

```bash
docker compose down -v
```

### 启动方式 2：前面再加一层自己的反向代理

如果你已经有自己的 Nginx 或外层 Caddy，可以继续保留，但推荐 **只代理宿主机暴露的 80/443 给内层 caddy**，不要去分别代理 `server`、`website`、`admin`。

后台仍然应该通过：

- `http://<你的域名>/admin`

而不是 `:3002` 直连。

## 自动化测试

这份仓库现在已经补上了针对拆分部署的自动化回归：

```bash
# 网站单测
pnpm --filter @vanblog/theme-default test -- --run

# 后端单测
pnpm --filter @vanblog/server test

# 部署配置检查
pnpm test:deploy

# 完整博客流程：构建 + 起 compose + 初始化 + 登录 + 发草稿 + 发布 + 前台访问
pnpm test:blog-flow
```

`pnpm test:blog-flow` 会自动验证这些关键路径：

- `/admin -> /admin/` 的跳转是否正常
- 后台 CSS / JS / logo / background 是否能被 `/admin/` 正确加载
- 初始化博客、后台登录、创建草稿、发布文章
- 前台首页、标签页、分类页、文章页是否能看到文章
- `mongo` 与 Caddy admin `2019` 是否没有被错误暴露

## 开发

### 本地前端 / 后端开发

```bash
pnpm install
pnpm dev
pnpm dev:website
```

### 本地容器联调

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f caddy server website admin waline mongo
```

如果你改动了 `/admin`、服务间通信、Caddy 路由、SSR/SSG 取数逻辑，建议至少重新执行：

```bash
pnpm build:website
pnpm build:admin
pnpm test:blog-flow
```

## 其他细节提示

- 后台前端代码是编译为静态文件后挂载的
- Waline 评论系统可以在后台选择关闭
- 分享我博客的部署链路：https://www.dong-blog.fun/post/2117
- 关于浏览量的设计问题：

	```
	总浏览量（viewer）和访客数（visited）：
	存储在 Meta 表的 viewer 和 visited 字段中
	viewer: 总访问次数（每次页面访问都+1）
	visited: 总访客数（新访客才+1，基于localStorage判断）
	每篇文章的浏览量：
	存储在 Article 表的 viewer 和 visited 字段中
	与网站总浏览量是独立计算的，不是累加关系
	```
