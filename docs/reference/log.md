---
title: 日志
icon: file-lines
order: 5
---

VanBlog 提供后台日志查看，同时也可以直接从 compose 层面查看各服务运行日志。

## 直接查看容器日志

源码部署：

```bash
docker compose logs -f caddy server website admin waline postgres redis
```

镜像部署：

```bash
docker compose -f docker-compose.image.yml logs -f caddy server website admin waline postgres redis
```

## 如果启用了 AI 工作台

AI 工作台本身的接口日志主要在 `server`，如果你还同时启用了 bundled FastGPT，建议额外关注：

```bash
docker compose -f docker-compose.image.yml -f docker-compose.ai-qa.yml -f docker-compose.fastgpt.yml \
  logs -f server fastgpt-app fastgpt-bootstrap
```

重点看：

- `server`：AI 工作台接口报错、会话读写、知识同步报错
- `fastgpt-app`：Dataset / App / API Key 创建异常、模型调用异常
- `fastgpt-bootstrap`：旧数据卷 free plan 修复情况

## 宿主机日志目录

默认情况下，`caddy` 和 `server` 共用宿主机的 `./log` 目录，对应容器内的 `/var/log`。

常见文件包括：

- `vanblog-access.log`：访问日志
- `caddy.log`：Caddy 运行日志
- `vanblog-event.log`：事件 / 审计类日志
- `restore.key`：忘记密码恢复密钥

## 后台日志管理

VanBlog 也提供登录日志、系统日志和流水线日志的后台查看入口。

![日志管理](https://pic.mereith.com/img/a76cceb104214002da3c0c92d592bfff.clipboard-2023-06-26.webp)
