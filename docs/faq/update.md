---
title: 升级常见问题
icon: cloud-arrow-up
order: 3
---

## 如何回滚

### latest 镜像部署

`docker-compose.latest.yml` 只会跟随当前最新发布，不记录历史版本。

如果你需要精确回滚，请切换到 `docker-compose.image.yml`，再把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成目标版本。

### latest 一文件 + AI

`docker-compose.latest.ai.yml` 同样不会记录历史版本。

如果你需要精确回滚，请切换到 `docker-compose.image.yml`，并按需叠加：

- `docker-compose.ai-qa.yml`
- `docker-compose.fastgpt.yml`

然后把 `.env` 中的 `VANBLOG_RELEASE_SUFFIX` 改成目标版本。

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

## 升级后 AI 工作台异常怎么办

先分清问题是在主栈，还是只在 AI overlay：

- 如果 `/admin`、前台、评论都正常，只是 `/admin/ai` 异常，优先排查 FastGPT 连接和 override
- 如果只是想先恢复博客主栈，可先移除 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml`
- 如果 bundled FastGPT 是旧数据卷，记得检查 `fastgpt-bootstrap` 是否已经修复 `team_subscriptions`

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
