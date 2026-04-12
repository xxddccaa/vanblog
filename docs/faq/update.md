---
title: 升级常见问题
icon: cloud-arrow-up
order: 3
---

## 如何回滚

### 镜像部署

把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改回旧版本，然后执行：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 源码部署

切回旧的 tag 或提交，再重新构建：

```bash
git checkout <tag-or-commit>
docker compose up -d --build
```

## docker 镜像拉取慢

可以提前拉取镜像，或为 Docker 配置镜像加速器。

## 升级后访问文章地址出现 404

VanBlog 的前台存在静态生成与重建过程。升级后如果某些页面尚未被重新生成，短时间内可能出现 404 或旧内容。

通常可以这样排查：

- 先访问首页、分类页、标签页，观察是否触发正常更新
- 再查看 `website` 和 `server` 日志是否有重建错误
- 如果是镜像升级，确认新镜像是否真的已经拉取成功

## 升级后后台持续加载或静态资源错乱

优先尝试强制刷新浏览器缓存：

- Windows / Linux：<kbd>Ctrl</kbd> + <kbd>F5</kbd>
- macOS：<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>

如果仍有问题，再查看：

```bash
docker compose logs -f admin caddy
```

## 容器无限重启

先看日志定位是哪一个服务反复退出：

```bash
docker compose ps
docker compose logs -f caddy server website admin waline postgres redis
```

如果你已经确定是升级引入的问题，优先回滚到上一个可用版本。

如果需要反馈问题，请附上关键日志并到当前仓库提 Issue：

- <https://github.com/xxddccaa/vanblog/issues/new/choose>
