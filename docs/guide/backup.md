---
title: 备份与迁移
icon: retweet
---

VanBlog 当前采用多容器部署，真正需要长期保存的是宿主机上的持久化目录与数据库数据。

<!-- more -->

## 推荐的两层备份

### 1. 后台逻辑备份

在后台 `站点管理 / 系统设置 / 备份恢复` 中执行导出。

这类备份适合：

- 导出文章、草稿、分类、标签、站点配置等业务数据
- 做升级前的快速安全备份
- 在已有实例之间迁移主要内容

### 2. 宿主机目录备份

如果你要做完整迁移或灾难恢复，更重要的是备份 compose 挂载出来的目录。

默认建议至少备份：

- `data/static`：本地图床与静态资源
- `data/postgres`：PostgreSQL 数据（包含 VanBlog 与 Waline 独立数据库）
- `data/redis`：Redis 数据
- `log`：运行日志与 `restore.key`
- `caddy/config`：Caddy 配置目录
- `caddy/data`：Caddy 证书与运行数据
- `aliyunpan/config`：如果启用了阿里云盘相关能力，也要一起备份

## 典型备份方式

在仓库根目录执行：

```bash
tar czf vanblog-backup-$(date +%F).tar.gz \
  data \
  log \
  caddy \
  aliyunpan \
  .env \
  docker-compose.yml \
  docker-compose.image.yml
```

如果某些目录不存在，可以按你的实际部署情况删掉。

## 迁移到新机器

1. 在新机器准备同版本仓库或相同的 compose 文件
2. 把备份文件解压到原来的相对路径
3. 检查 `.env`、端口、域名、证书目录是否与新机器匹配
4. 重新启动服务

源码部署：

```bash
docker compose up -d --build
```

镜像部署：

```bash
docker compose -f docker-compose.image.yml up -d
```

## 额外提醒

- 如果只导出了后台数据，没有备份 `data/static`，本地图床文件不会自动恢复
- 如果没有备份 `caddy/data`，证书可能需要重新申请
- 如果只是容器重建而挂载目录未丢失，通常不会丢数据
- 更细的导入导出说明可参考 [导入导出](../advanced/backup.md)
