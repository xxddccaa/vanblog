---
title: RSS
icon: rss
---

VanBlog 内置了 `RSS feed 生成器`，开箱即用。

<!-- more -->

## 简介

你可以从站点的以下地址获取 RSS：

- `<your-site-url>/feed.xml`: RSS 2.0 格式
- `<your-site-url>/feed.json`: JSON Feed 1.1 格式
- `<your-site-url>/atom.xml`: Atom 1.0 格式

导航栏右上角会默认出现 `RSS` 按钮。你可以在后台的布局设置中关闭此按钮。

VanBlog 包含后端 Markdown 渲染能力，因此在支持 HTML 的 RSS 阅读器中，通常可以获得与网页较接近的阅读体验。

![Feedbro Reader 浏览效果](https://www.mereith.com/static/img/bf84404095bdcf8c4a186e0bb1e48429.clipboard-2022-09-04.png)

![irreader 阅读效果](https://www.mereith.com/static/img/4b1ab8a59a5b6f0d28eef449db64cbfa.clipboard-2022-09-04.png)

::: note

RSS 中的 HTML 暂不支持 Mermaid 图表。如果你有更好的方案，欢迎提交 Issue 或 PR。

:::

## 信息生成

- 作者：RSS 中的作者邮箱优先取自 `评论设置` 中的作者邮箱，其次是 `EMAIL` 环境变量
- 图标：`favicon` 与 `images` 字段优先从站点配置中推导
- 摘要：每篇文章的 `description` 优先取自 `<!-- more -->` 之前的内容，没有的话会退回全文提取

![图标/图片优先级](https://www.mereith.com/static/img/27f6636bfe5a53cf51544ab8affd6961.clipboard-2022-09-04.png)
