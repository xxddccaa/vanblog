---
title: 使用常见问题
icon: wrench
order: 2
---

## 后台编辑器主题颜色错乱

这通常和浏览器或系统的主题强制覆盖有关。把浏览器主题偏好改成“默认”或“跟随系统”后再刷新即可。

## 文章编辑器内容不对题

编辑器会把内容实时缓存到浏览器的 LocalStorage，并且以文章 ID 或草稿 ID 作为键。

如果你做过迁移、恢复或重新导入数据，旧缓存可能和当前内容错位。解决方法是进入编辑器右上角菜单，手动清理这篇内容的本地缓存。

## 图片（作者 logo）加载不出来

通常是 `website` 服务的 `VAN_BLOG_ALLOW_DOMAINS` 没有包含当前图片域名。

例如：

- 用 `cdn.example.com` 托管图片，就要把它加入 `VAN_BLOG_ALLOW_DOMAINS`
- 本地开发如果使用 `localhost`，也要把 `localhost` 加进去
- 多个域名用英文逗号分隔

修改后重启 `website` 服务即可。

## 在编辑器复制后格式错乱

默认粘贴可能会带上源站样式。建议优先使用纯文本粘贴：

- 右键选择“粘贴为纯文本”
- 或使用 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>

![粘贴示例](https://pic.mereith.com/img/88b29bad4ad0ef7d6e411e43f80ec1bc.clipboard-2022-08-22.png)

## 开启了 HTTPS 重定向后关不掉

如果后台已经打不开，可以直接删除数据库里的 HTTPS 设置，再重启 `server` 服务同步配置。

```bash
docker compose exec mongo mongo vanBlog --quiet --eval 'db.settings.deleteOne({ type: "https" })'
docker compose restart server
```

如果你使用的是镜像部署，只需要把命令里的 compose 文件替换成你实际使用的那一套，例如：

```bash
docker compose -f docker-compose.image.yml exec mongo mongo vanBlog --quiet --eval 'db.settings.deleteOne({ type: "https" })'
docker compose -f docker-compose.image.yml restart server
```
