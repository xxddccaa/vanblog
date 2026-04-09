---
title: 反代
icon: refresh
order: 4
---

::: info 注意

当前仓库默认已经通过 compose 编排（`docker-compose.yml` 或 `docker-compose.image.yml`）启动一个对外网关 `caddy`，统一接收 `80/443` 流量并路由到 `server`、`website`、`admin`、`waline`。

如果你还要在外面再套一层反向代理，请直接代理到 **宿主机暴露的 Caddy 端口**，而不是分别去代理 `server` / `website` / `admin`。通常你只需要：

1. 让外层反代指向宿主机的 `80` 或 `443`
2. 保持内部 `caddy` 继续处理 `/admin`、`/api`、前台页面、评论等路由
3. 不要额外暴露 `mongo`、Caddy admin `2019`、或内部服务端口

:::

## 反代方式

### nginx-proxy-manager

推荐使用 [nginx-proxy-manager](https://nginxproxymanager.com/) 之类的图形化代理工具统一管理外层域名与证书。

### Caddy

如果你希望用外层 Caddy 统一管理证书，可以将其反代到 VanBlog 这套 compose 暴露的 `80/443`。

配置示例：

::: code-tabs

@tab Caddy V2

```conf
example.com {
  tls admin@example.com
  reverse_proxy 127.0.0.1:80 {
    trusted_proxies private_ranges
  }
}
```

:::

### Nginx

如果你想用 Nginx 做外层反代，也可以直接把整站代理到本机的 `80` 端口：

::: code-tabs

@tab Http

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
  }
}
```

@tab Https

```nginx
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name example.com;
  ssl_certificate /path/to/public.crt;
  ssl_certificate_key /path/to/private.key;

  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
  }
}
```

:::

::: warning 注意

- 如果外层已经处理证书，可以按需关闭或调整内层 Caddy 的 HTTPS 行为
- `/admin` 必须保持走同一个入口域名，不要把后台单独改成 `:3002` 直连
- 如果出现页面不更新、跳转异常，优先检查外层反代是否错误改写了 `Location`、`Host`、缓存策略或子路径资源

:::
