---
title: 从零开始
icon: signs-post
index: false
---

如果你是第一次在服务器上部署 VanBlog，可以先确认下面这些准备项。

## 1. 服务器要求

VanBlog 当前默认走 Docker Compose 多容器部署，建议准备一台常见 Linux 服务器。

| 项目 | 建议 | 说明 |
| ---- | ---- | ---- |
| 内存 | >= 2G | 小站点通常够用，初始化或构建时会更从容 |
| CPU | >= 1 核 | 个人博客对 CPU 要求不高 |
| 磁盘 | >= 20G | 需要为镜像、日志、图床与数据库预留空间 |
| 架构 | `x64` / `arm64` | 当前仓库已优先按容器方式维护 |
| 系统 | Ubuntu / Debian / CentOS / 其他主流 Linux | 以能稳定运行 Docker 为准 |

## 2. 域名与 DNS

如果你准备启用 HTTPS，建议提前准备域名并把解析指向服务器公网 IP。

至少确认：

- 域名 A 记录或 AAAA 记录已正确指向服务器
- 服务器的 `80/443` 端口可以被公网访问
- 云厂商安全组、本机防火墙都已放行相应端口

## 3. 国内服务器备案

如果你使用中国大陆服务器并准备绑定域名对外提供服务，通常需要先完成备案。具体要求以你的云厂商和当地政策为准。

## 4. Docker 环境

开始部署前，请先确认这些命令可用：

```bash
docker --version
docker compose version
```

如果还没有安装 Docker，可以回到 [快速上手](./get-started.md) 按当前文档中的 Compose 部署流程继续。

## 5. 初始化入口

部署完成后，请使用浏览器打开：

```text
http://<你的域名>/admin/init
```

如果域名、端口和证书配置都已就绪，也可以直接访问：

```text
https://<你的域名>/admin/init
```

具体 HTTPS 行为可参考：[HTTPS](../advanced/https.md)

如果需要在外层再套一层反向代理，可参考：[反代](../reference/reverse-proxy.md)
