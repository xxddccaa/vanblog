---
title: 导入导出
icon: right-to-bracket
---

::: warning 备份与迁移

如果你要做的是完整迁移、灾备或回滚，优先参考 [备份与迁移](../guide/backup.md)。

:::

VanBlog 后台支持数据的导入和导出。点击后台 `站点管理 / 系统设置 / 备份恢复`，即可导入或导出主要业务数据。

![导入/导出](https://www.mereith.com/static/img/917addce2307bc0e470883de035472f5.clipboard-2022-09-01.png)

## 这类导出适合什么

后台导入导出更适合处理：

- 文章、草稿、分类、标签等内容数据
- 站点配置与部分业务配置
- 快速做一次逻辑层备份

## 这类导出不覆盖什么

它不等价于完整的部署级备份。以下内容仍建议单独备份宿主机目录：

- 本地图床文件本身
- MongoDB 原始数据目录
- Caddy 证书目录
- 自定义页面上传文件
- 日志与 `restore.key`

## 导出全部图片

VanBlog 支持导出全部 `本地图床图片` 为压缩包。你可以在后台图片设置中执行该操作。

![导出全部图片](https://www.mereith.com/static/img/dd5f0f0a1ff61a1a5d22c09fcaa8178c.clipboard-2022-09-01.png)

::: tip

OSS 图床通常不需要从这里导出，建议直接通过对应云存储控制台做备份。

:::
