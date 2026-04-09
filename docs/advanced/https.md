---
title: HTTPS
icon: certificate
order: 1
---

VanBlog 当前由独立的 `caddy` 服务负责统一入口，并支持自动 HTTPS 证书申请与 HTTP -> HTTPS 重定向配置。

<!-- more -->

::: info Caddy

[Caddy](https://caddyserver.com/) 是一款默认支持自动 HTTPS 与证书续期的 Web 服务器。

:::

## 开启 HTTPS 的前提

请先确认：

- 部署时已经为 `caddy` 设置了 `EMAIL` 环境变量
- 对外开放了 `80/443` 端口
- 域名已经正确解析到当前服务器
- 当前访问使用的是域名而不是裸 IP

## 使用方式

VanBlog 首次运行默认通过 HTTP 访问即可。初始化完成后，使用 `https://<你的域名>` 访问站点时，Caddy 会按需申请证书。

如果你想主动触发一次检查，可以在后台的 HTTPS 设置页面中操作。

![申请证书](https://pic.mereith.com/img/8383fb4f32144be26cb134c2390d6d10.clipboard-2022-08-23.png)

::: tip

1. 如果超过几分钟仍未生效，请优先检查 DNS、端口和日志
2. 只有域名可以申请证书，IP 地址不能用于自动签发公网证书

:::

## HTTPS 自动重定向

确认 HTTPS 已经可以正常访问后，再考虑开启 `https 自动重定向`。这样所有 `http` 请求都会跳转到 `https`。

这个配置会保存在数据库中，并在 `server` 启动时同步到 `caddy`。

![开启 https 自动重定向](https://pic.mereith.com/img/d1e7b502279f0bd8225dfaedf89a5140.clipboard-2022-08-23.png)

::: note

- 开启后，不能再通过 `http + ip` 的方式访问站点
- 无论是否开启重定向，都不支持 `https + IP` 的访问方式

:::

## 排查方式

### 1. 查看 compose 日志

```bash
docker compose logs -f caddy server
```

### 2. 查看宿主机日志目录

默认日志文件在 `./log` 中，包括：

- `vanblog-access.log`
- `caddy.log`

### 3. 检查外层反代

如果你额外套了 Nginx / Caddy / CDN，请先确认它没有拦截证书申请流程，也没有错误改写回源协议与 Host。
