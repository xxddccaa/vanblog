---
title: 升级
icon: cloud-arrow-up
order: -3
---

当前仓库已经不再使用旧的一键脚本或单镜像部署方式。升级时请根据你使用的编排文件，按“源码部署”或“镜像部署”两种方式处理。

## 升级前建议

无论使用哪种部署方式，升级前都建议先做一份备份：

- 后台执行一次 `站点管理 / 系统设置 / 备份恢复` 的导出
- 备份宿主机上的持久化目录，至少包括 `data/`、`log/`、`caddy/`

具体可参考：[备份与迁移](./backup.md)

## 源码部署升级

适用于使用 `docker-compose.yml` 从当前仓库构建运行的场景。

```bash
git pull
docker compose up -d --build
```

如果依赖、镜像层或构建缓存异常，也可以先停后起：

```bash
docker compose down
docker compose up -d --build
```

## 镜像部署升级

适用于使用 `docker-compose.image.yml` 拉取已发布镜像的场景。

1. 修改 `.env` 中的版本变量，例如：

```env
VANBLOG_RELEASE_SUFFIX=v1.0.0-<image-id>
```

2. 拉取并启动新版本：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

## 如何回滚

### 镜像部署回滚

把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改回旧版本，然后重新执行：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 源码部署回滚

切回旧的 Git tag 或提交，再重新构建：

```bash
git checkout <tag-or-commit>
docker compose up -d --build
```

## 升级后建议检查

- `http://<你的域名>/admin` 是否正常打开
- `http://<你的域名>/admin/init` 是否不会误出现
- 前台首页、文章页、分类页、标签页是否正常访问
- 评论、图片、RSS、Swagger 是否仍可访问
- `docker compose logs -f caddy server website admin waline postgres redis` 是否有明显报错

## 常见问题

- 详见 [升级常见问题](../faq/update.md)
