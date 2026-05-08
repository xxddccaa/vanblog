---
title: 升级常见问题
icon: cloud-arrow-up
order: 3
---

## 如何回滚

### latest 镜像部署

`docker-compose.latest.yml` 只会跟随当前最新发布，不记录历史版本。

如果你需要精确回滚，请切换到 `docker-compose.image.yml`，再把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成目标版本。

### 锁版镜像部署

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

## 升级后后台持续加载或静态资源错乱

优先尝试强制刷新浏览器缓存。

## 容器无限重启

先看日志定位是哪一个服务反复退出：

```bash
docker compose ps
docker compose logs -f caddy server website admin waline postgres redis
```
