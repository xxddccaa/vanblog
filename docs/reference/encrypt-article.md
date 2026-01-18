---
title: 加密文章实现原理
icon: lock
order: 11
---

## 功能概述

VanBlog 支持文章加密功能，有两种解锁方式：

1. **密码解锁**：访客输入文章密码解锁
2. **Admin Token 自动解锁**：博主在后台登录后，访问前台加密文章自动解锁

## 核心实现原理

### 跨系统认证机制

前台和后台通过 **localStorage 共享 token** 实现认证状态互通：

```
后台登录 → token 存入 localStorage → 前台读取 token → 自动解锁加密文章
```

由于前台和后台部署在同一域名下（通过 Caddy 反向代理），`localStorage` 是共享的。

## 关键代码流程

### 1. 后台登录存储 Token

**文件**: `packages/admin/src/pages/user/Login/index.jsx`

```javascript
if (msg.statusCode === 200) {
  const token = msg.data.token;
  window.localStorage.setItem('token', token);
  // ...
}
```

### 2. 前台自动检查 Token

**文件**: `packages/website/components/UnLockCard/index.tsx`

```typescript
useEffect(() => {
  const checkAdminToken = async () => {
    if (adminChecked) return;
    setAdminChecked(true);

    // 从 localStorage 获取 token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (token) {
      try {
        setLoading(true);
        // 使用 admin 接口获取文章内容
        const article = await getArticleByIdOrPathnameWithAdminToken(props.id, token);
        if (article) {
          onSuccess("Admin自动解锁成功！");
          props.setContent(article.content);
          props.setLock(false);
          return;
        }
      } catch (err) {
        // Token 无效，继续显示密码输入框
      }
      setLoading(false);
    }
  };
  checkAdminToken();
}, [props.id, adminChecked]);
```

### 3. API 接口实现

**前台 API 调用**: `packages/website/api/getArticles.ts`

```typescript
// 使用 Admin Token 获取文章
export const getArticleByIdOrPathnameWithAdminToken = async (
  id: number | string,
  token: string
) => {
  const url = `/api/public/article/${id}/admin`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const { statusCode, data } = await res.json();
  return statusCode === 200 ? data : null;
};

// 使用密码获取文章
export const getArticleByIdOrPathnameWithPassword = async (
  id: number | string,
  password: string
) => {
  const url = `/api/public/article/${id}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const { data } = await res.json();
  return data;
};
```

### 4. 后端验证逻辑

**Admin Token 验证**: `packages/server/src/controller/public/public.controller.ts`

```typescript
@Post('/article/:id/admin')
async getArticleByIdOrPathnameWithAdminToken(
  @Param('id') id: number | string,
  @Body() body: { token: string },
) {
  // 验证 token 是否有效
  const isValidToken = await this.tokenProvider.checkToken(body?.token);
  if (!isValidToken) {
    return { statusCode: 401, data: null, message: 'Invalid token' };
  }

  // Token 有效则直接返回完整文章内容（无需密码）
  const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
  if (data) {
    const articleData = (data as any)?._doc || data;
    return {
      statusCode: 200,
      data: { ...articleData, password: undefined },
    };
  }
  return { statusCode: 404, data: null, message: 'Article not found' };
}
```

**密码验证**: `packages/server/src/provider/article/article.provider.ts`

```typescript
async getByIdWithPassword(id: number | string, password: string): Promise<any> {
  const article = await this.getByIdOrPathname(id, 'admin');
  if (!password || !article) return null;

  // 检查分类密码（优先级更高）
  const category = await this.categoryModal.findOne({ name: article.category });
  const categoryPassword = category?.private ? category.password : undefined;
  const targetPassword = categoryPassword || article.password;

  if (!targetPassword || targetPassword === '') {
    return { ...(article?._doc || article), password: undefined };
  }

  // 验证密码
  if (targetPassword === password) {
    return { ...(article?._doc || article), password: undefined };
  }
  return null;
}
```

### 5. Token 校验

**文件**: `packages/server/src/provider/token/token.provider.ts`

```typescript
async checkToken(token: string) {
  const result = await this.tokenModel.findOne({ token, disabled: false });
  return !!result;
}
```

## 数据模型

### 文章 Schema

```typescript
// packages/server/src/scheme/article.schema.ts
@Prop({ default: false, index: true })
private: boolean;  // 是否加密

@Prop({ default: '' })
password: string;  // 文章密码
```

### Token Schema

```typescript
// packages/server/src/scheme/token.schema.ts
@Prop({ index: true })
token: string;

@Prop({ default: false, index: true })
disabled: boolean;  // 是否禁用
```

## 流程图

```
┌────────────────────────────────────────────────────────┐
│                    用户访问加密文章                      │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  检查 localStorage   │
              │    是否有 token      │
              └──────────────────────┘
                    │           │
              有 token       无 token
                    │           │
                    ▼           ▼
         ┌─────────────┐  ┌─────────────┐
         │ 调用 admin  │  │ 显示密码框  │
         │   API 验证  │  │             │
         └─────────────┘  └─────────────┘
               │                 │
         ┌─────┴─────┐     用户输入密码
         │           │           │
     token有效   token无效       ▼
         │           │    ┌─────────────┐
         ▼           ▼    │ 调用密码API │
    ┌─────────┐  ┌──────┐ │   验证密码  │
    │自动解锁 │  │显示  │ └─────────────┘
    │无需密码 │  │密码框│       │
    └─────────┘  └──────┘  ┌────┴────┐
                           │         │
                       密码正确  密码错误
                           │         │
                           ▼         ▼
                      ┌────────┐ ┌────────┐
                      │ 解锁   │ │ 提示   │
                      │ 文章   │ │ 错误   │
                      └────────┘ └────────┘
```

## 关键文件清单

| 文件 | 功能 |
|------|------|
| `packages/website/components/UnLockCard/index.tsx` | 前台解锁组件 |
| `packages/website/api/getArticles.ts` | 前台 API 调用 |
| `packages/website/utils/auth.ts` | 认证工具函数 |
| `packages/admin/src/pages/user/Login/index.jsx` | 后台登录页面 |
| `packages/server/src/controller/public/public.controller.ts` | 公开 API 端点 |
| `packages/server/src/provider/article/article.provider.ts` | 文章业务逻辑 |
| `packages/server/src/provider/token/token.provider.ts` | Token 管理 |

## 设计要点

1. **localStorage 共享**：前后台同域，localStorage 天然共享
2. **优先级策略**：先尝试 token 自动解锁，失败再显示密码框
3. **安全考虑**：返回文章时移除 password 字段
4. **分类密码优先**：分类设置的密码优先级高于文章密码
5. **Token 可禁用**：支持通过 `disabled` 字段禁用特定 token
