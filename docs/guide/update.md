---
title: 升级
icon: cloud-arrow-up
order: -3
---

当前仓库已经不再使用旧的一键脚本或历史遗留单镜像方案。升级时请先确认自己使用的是哪一套 compose 文件，再按对应路径处理。

## 升级前建议

无论使用哪种部署方式，升级前都建议先做一份备份：

- 后台执行一次 `站点管理 / 系统设置 / 备份恢复` 的导出
- 备份宿主机上的持久化目录，至少包括 `data/`、`log/`、`caddy/`

## 先确认自己是哪条部署路径

| 路径 | 常见文件 | 升级方式 |
| --- | --- | --- |
| 源码部署 | `docker-compose.yml` | 重新拉代码并 `up -d --build` |
| latest 主栈 | `docker-compose.latest.yml` | `pull` 后重新 `up -d` |
| latest 单镜像 | `docker-compose.all-in-one.latest.yml` | `pull` 后重新 `up -d` |
| 锁版镜像部署 | `docker-compose.image.yml` + `.env` | 改 `.env` 里的 `VANBLOG_RELEASE_SUFFIX` 再升级 |

## 源码部署升级

```bash
git pull
docker compose up -d --build
```

## latest 镜像部署升级

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

## latest 单镜像升级

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

## 锁版镜像部署升级

1. 修改 `.env` 中的版本变量，例如：

```env
VANBLOG_RELEASE_SUFFIX=v1.6.2-<image-id>
```

2. 拉取并启动新版本：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

## 如何回滚

### latest 镜像部署回滚

`docker-compose.latest.yml` 本身不会记录历史版本，因此它不适合做精确回滚。

如果你需要回滚，请改用 `docker-compose.image.yml`，并把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成要回退到的具体版本。

### 锁版镜像部署回滚

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
