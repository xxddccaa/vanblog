---
home: true
icon: home
index: false
heroText: VanBlog
heroImage: /merge.png
tagline: 一套基于 Docker Compose 多容器架构的个人博客系统。
actions:
  - text: 💡 快速上手
    link: /guide/get-started.html
    type: primary

  - text: 🏷️ 发布说明
    link: /releases/
    type: secondary

  - text: GitHub 仓库
    link: https://github.com/xxddccaa/vanblog
    type: secondary

features:
  - title: 多容器架构
    icon: cubes
    details: 默认拆分为 caddy、server、website、admin、postgres、redis 六个服务，部署与排障更清晰

  - title: 前后台一体
    icon: window-maximize
    details: 内置前台站点、后台管理、公开 API 与评论服务，统一由 Caddy 对外转发

  - title: 写作体验
    icon: pen-to-square
    details: 草稿、分类、标签、搜索、TOC、Mermaid、LaTeX、评论和图床等能力开箱即用

  - title: 可维护性
    icon: wrench
    details: 提供部署测试、博客流程测试、多镜像发布规范与回滚文档，方便长期维护

  - title: HTTPS 与代理
    icon: lock
    details: 使用 Caddy 处理统一入口，支持自动证书申请、反向代理和 /admin 子路径部署

  - title: 自定义能力
    icon: wand-magic-sparkles
    details: 支持自定义 CSS、HTML、JS、自定义页面、图床配置与更多运行时调整

copyright: false
footer: GPL-3.0 | 源于 VanBlog，现由 xxddccaa 持续维护
---
