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
- 如果启用了 bundled FastGPT，再额外备份 `data/fastgpt/`

具体可参考：[备份与迁移](./backup.md)

## 先确认自己是哪条部署路径

| 路径 | 常见文件 | 升级方式 |
| --- | --- | --- |
| 源码部署 | `docker-compose.yml` | 重新拉代码并 `up -d --build` |
| latest 主栈 | `docker-compose.latest.yml` | `pull` 后重新 `up -d` |
| latest 一文件 + AI | `docker-compose.latest.ai.yml` | `pull` 后重新 `up -d` |
| latest 单镜像（无 AI） | `docker-compose.all-in-one.latest.yml` | `pull` 后重新 `up -d` |
| 锁版镜像部署 | `docker-compose.image.yml` + `.env` | 改 `.env` 里的 `VANBLOG_RELEASE_SUFFIX` 再升级 |
| 锁版 + AI override | `docker-compose.image.yml` + AI override | 主栈升级后继续保留或移除 AI overlay |

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

## latest 镜像部署升级

适用于使用 `docker-compose.latest.yml` 直接拉取 `latest` 镜像的场景。

```bash
docker compose -f docker-compose.latest.yml pull
docker compose -f docker-compose.latest.yml up -d
```

注意：

- 这种方式适合快速升级到当前最新发布
- 但它不适合精确回滚到某个历史版本

## latest 一文件 + AI 升级

适用于使用 `docker-compose.latest.ai.yml` 的场景。

```bash
docker compose -f docker-compose.latest.ai.yml pull
docker compose -f docker-compose.latest.ai.yml up -d
```

说明：

- 主栈和 bundled FastGPT 会一起按当前 quick-start 基线升级
- 如果只是想临时禁用 AI，可切回 `docker-compose.latest.yml`

## latest 单镜像升级

适用于使用 `docker-compose.all-in-one.latest.yml` 的场景。

```bash
docker compose -f docker-compose.all-in-one.latest.yml pull
docker compose -f docker-compose.all-in-one.latest.yml up -d
```

说明：

- 这个路径只覆盖非 AI 主栈
- `postgres` / `redis` 会继续复用原来的持久化目录

## 锁版镜像部署升级

适用于使用 `docker-compose.image.yml` 拉取已发布镜像，并通过 `.env` 锁定版本的场景。

1. 修改 `.env` 中的版本变量，例如：

```env
VANBLOG_RELEASE_SUFFIX=v1.4.1-<image-id>
```

2. 拉取并启动新版本：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

## 锁版 + AI overlay 升级

如果你已经启用了 AI 工作台：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d
```

如果同时启用了 bundled FastGPT：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

升级时请记住：

- 核心镜像升级和 bundled FastGPT 基线不是一回事
- 默认发布 `v1.4.1` 及后续小版本时，不主动修改 `docker-compose.fastgpt.yml` 的固定版本矩阵
- 如果只是 VanBlog 核心镜像升级，通常不需要顺带刷新 FastGPT 依赖

## 如何回滚

### latest 镜像部署回滚

`docker-compose.latest.yml` 本身不会记录历史版本，因此它不适合做精确回滚。

如果你需要回滚，请改用 `docker-compose.image.yml`，并把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成要回退到的具体版本。

### latest 一文件 + AI 回滚

`docker-compose.latest.ai.yml` 同样不记录历史版本。

如果你需要精确回滚，建议切换到：

- `docker-compose.image.yml`
- `docker-compose.ai-qa.yml`
- `docker-compose.fastgpt.yml`

然后把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成目标版本。

### 锁版镜像部署回滚

把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改回旧版本，然后重新执行：

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 只回退 AI 能力

如果主栈没问题，只是 AI 工作台或 FastGPT 相关能力不稳定，可以直接移除 override：

```bash
docker compose -f docker-compose.image.yml up -d
```

这样不会影响博客主栈继续在线。

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
- 如果启用了 AI，`/admin/ai` 是否可打开，是否仍能看到历史会话
- `docker compose logs -f caddy server website admin waline postgres redis` 是否有明显报错

## 常见问题

- 详见 [升级常见问题](../faq/update.md)
