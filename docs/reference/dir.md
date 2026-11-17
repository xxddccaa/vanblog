---
title: 目录映射
icon: folder-tree
order: 3
---

VanBlog 当前采用多容器部署。为了在升级、重建容器后保留数据，请确保 compose 中的持久化目录被正确映射到宿主机。

## 默认映射关系

| 宿主机默认目录 | 容器内目录 | 说明 |
| --- | --- | --- |
| `./data/static` | `/app/static` | 本地图床与静态资源（访客评论图片在 `img/comment/` 下） |
| `./data/postgres` | `/var/lib/postgresql/data` | PostgreSQL 数据目录（博客内容与评论都在 `vanblog` 库中；从旧版本升级的部署里还会保留不再使用的 `waline` 库） |
| `./data/redis` | `/data` | Redis 数据目录 |
| `./log` | `/var/log` | 访问日志、事件日志、备份文件和站点共享密钥 `vanblog-shared.secret` |
| `./secrets` | `/run/secrets/vanblog` | 独立备份加密密钥；权限应限制为仅部署管理员可读 |
| `./caddy/config` | `/root/.config/caddy` | Caddy 配置目录 |
| `./caddy/data` | `/root/.local/share/caddy` | Caddy 证书与运行数据 |
| `./aliyunpan/config` | `/root/.config/aliyunpan` | 可选的阿里云盘配置目录 |

## 建议

- 升级前优先确认这些目录都在宿主机上可见
- 生产环境建议把这些目录纳入常规备份
- `./secrets` 应另存到密码管理器或密钥系统，不要只与加密备份保存在同一位置
- 如果你改过 compose 里的路径，请以你自己的映射为准
