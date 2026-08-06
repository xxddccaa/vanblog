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

## 宿主机日志目录

默认情况下，`caddy` 和 `server` 共用宿主机的 `./log` 目录，对应容器内的 `/var/log`。

常见文件包括：

- `vanblog-access.log`：访问日志
- `caddy.log`：Caddy 运行日志
- `vanblog-event.log`：事件 / 审计类日志
- `restore.key`：忘记密码恢复密钥

## 日志降噪与轮转（v1.7.2+）

默认配置已做过治理，开箱即净：

- **服务端日志级别**：环境变量 `VAN_BLOG_LOG_LEVEL` 控制，取值 `silent`（仅 error）/ `balanced`（默认，error+warn+log，砍掉 debug/verbose 与启动路由表噪音）/ `verbose`（全开，排障时用）。改后重启 `server` 生效。
- **健康检查不再记 access log**：Caddy 通过 `log_skip` 跳过每 15 秒一次的内部探活（`Wget` UA + 路径 `/`），`vanblog-access.log` 不再被健康检查刷爆；同时对该文件加了 `roll_size 5MiB / roll_keep 3` 滚动上限。
- **Redis 降噪**：`REDIS_LOGLEVEL`（默认 `warning`）压掉每 5 分钟的 RDB 存盘流水。
- **docker logs 落盘封顶**：所有 compose 的每个服务都配了 `json-file` 轮转（`max-size 10m` × `max-file 3`），长期运行不会涨爆磁盘。
- **stdio 镜像文件上限**：`vanblog-stdio.log`（后台「系统日志」数据源）超过 10MB 自动滚动一份，不再无限增长。

> all-in-one 单容器部署下，`VAN_BLOG_WALINE_API_URL` 默认已指向本机 `http://127.0.0.1:8360`，修复了历史上评论数取不到、并每次访问刷 `ENOTFOUND waline` 的问题——一般无需改动。

## 后台日志管理

VanBlog 也提供登录日志、系统日志和流水线日志的后台查看入口。

![日志管理](https://pic.mereith.com/img/a76cceb104214002da3c0c92d592bfff.clipboard-2023-06-26.webp)
