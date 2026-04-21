---
home: true
icon: home
index: false
heroText: VanBlog
heroImage: /merge.png
tagline: 一套基于 Docker Compose 多容器架构、支持可选 AI 工作台的个人博客系统。
actions:
  - text: 💡 快速上手
    link: /guide/get-started.html
    type: primary

  - text: 🤖 AI 工作台
    link: /ai-qa-fastgpt.html
    type: secondary

  - text: 🏷️ 发布说明
    link: /releases/
    type: secondary

  - text: GitHub 仓库
    link: https://github.com/xxddccaa/vanblog
    type: secondary

features:
  - title: 多容器架构
    icon: cubes
    details: 默认拆分为 caddy、server、website、admin、waline、postgres、redis 七个服务，部署与排障更清晰

  - title: 前后台一体
    icon: window-maximize
    details: 内置前台站点、后台管理、公开 API 与评论服务，统一由 Caddy 对外转发

  - title: 可选 AI 工作台
    icon: robot
    details: /admin/ai 面向所有管理员开放，可把博客内容同步到 FastGPT 作为知识增强，但默认部署不会强行带 AI

  - title: 可维护性
    icon: wrench
    details: 提供 latest 与锁版双轨部署文档、部署测试、博客流程测试、多镜像发布规范与回滚说明

  - title: HTTPS 与代理
    icon: lock
    details: 使用 Caddy 处理统一入口，支持自动证书申请、反向代理和 /admin 子路径部署

  - title: 自定义能力
    icon: wand-magic-sparkles
    details: 支持自定义 CSS、HTML、JS、自定义页面、图床配置与更多运行时调整

copyright: false
footer: GPL-3.0 | 源于 VanBlog，现由 xxddccaa 持续维护
---
