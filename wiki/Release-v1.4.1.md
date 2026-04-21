# Release-v1.4.1

`v1.4.1` 是一次 AI 工作台补丁发布，重点解决多博客共享同一套 FastGPT 时，VanBlog 自动创建资源可能串用的问题。

## 重点变化

- 为每个博客引入持久化到 PG 的 `blogInstanceId`（UUID v4）
- 自动创建的 FastGPT `Dataset / App / API Key` 全部切到 `managedV2` 命名：`站点标签 + blogInstanceId`
- `/admin/ai` 页面会静默识别旧版 VanBlog 自动资源，并在条件满足时自动迁移
- 手工填写的资源仍然保留 `manual` 模式，不参与自动迁移和自动删除

## 运维影响

- 默认主栈拓扑不变，AI 仍然是 `docker-compose.ai-qa.yml` / `docker-compose.fastgpt.yml` 按需叠加
- bundled FastGPT 固定版本矩阵不变
- 已有 `v1.4.0` 单博客站点通常可以直接升级
- 多博客共享 FastGPT 场景建议优先升级到 `v1.4.1`

## 发布镜像示例

```env
VANBLOG_DOCKER_REPO=kevinchina/deeplearning
VANBLOG_RELEASE_SUFFIX=v1.4.1-<image-id>
```

```bash
docker compose -f docker-compose.image.yml up -d
```

如需 AI：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml up -d
```

如需 bundled FastGPT：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml up -d
```

## 升级后建议验收

1. 打开 `/admin` 与 `/admin/ai`
2. 如果是共享 FastGPT 场景，确认自动资源名称已经切到带博客 UUID 的新命名
3. 执行一次全量同步并确认聊天链路正常
4. 如需回滚，把 `VANBLOG_RELEASE_SUFFIX` 改回上一版，例如 `v1.4.0-<image-id>`

仓库内完整版发布说明见：[`docs/releases/v1.4.1.md`](../docs/releases/v1.4.1.md)
