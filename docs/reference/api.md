---
title: API 参考
icon: plug
order: 6
---

VanBlog 当前没有单独维护一份静态 API 文档，建议直接以运行中的 Swagger 为准。

## API 文档入口

你可以在后台的 `系统设置 / Token 管理` 中点击 `API 文档`。默认通过 Caddy 的公网入口不会暴露 Swagger；如果你需要直接访问，请使用主机本地或容器内的 `server` 服务入口，不要依赖公网域名下的 `/swagger`：

```text
http://<server 本地入口>/swagger
```

![API 文档入口](https://pic.mereith.com/img/d78409dcfb170ea71289ac38d9430165.clipboard-2023-03-17.png)

## 公开接口

`public` 标签下的接口通常不需要鉴权，例如：

```text
GET /api/public/article/:id
```

你可以把它拼成完整地址调用，例如：

```text
http://<你的域名>/api/public/article/1
```

## 鉴权方式

所有需要鉴权的接口，默认通过请求头中的 `token` 字段进行校验。你可以在后台的 `系统设置 / Token 管理` 中创建和管理这些 Token。
