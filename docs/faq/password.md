---
title: 忘记密码
icon: question
---

VanBlog 支持通过恢复密钥重置超级管理员密码。在登录页面点击 `忘记密码`，输入正确的恢复密钥即可继续重置。

![查看看恢复密钥](https://pic.mereith.com/img/471a81dc548ad543814a6bbf7315ccf1.clipboard-2022-09-20.png)

## 恢复密钥获取方式

### 1. 查看服务日志

每次 VanBlog 初始化或旧恢复密钥被使用后，都会重新生成恢复密钥并写入日志。

源码部署：

```bash
docker compose logs -f server
```

镜像部署：

```bash
docker compose -f docker-compose.image.yml logs -f server
```

### 2. 查看挂载出来的日志目录

恢复密钥同时也会写入日志目录中的 `restore.key` 文件。

默认情况下，对应宿主机路径是：

```text
./log/restore.key
```

### 3. 直接进入容器读取

源码部署：

```bash
docker compose exec server cat /var/log/restore.key
```

镜像部署：

```bash
docker compose -f docker-compose.image.yml exec server cat /var/log/restore.key
```
