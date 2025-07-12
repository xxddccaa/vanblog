# ContentSearchModal - 内容搜索组件

## 功能介绍

内容搜索组件是为VanBlog后台管理系统设计的全文搜索功能，支持在文章和草稿中进行内容搜索。

## 主要特性

- **全文搜索**：支持搜索标题、内容、分类和标签
- **实时预览**：显示搜索结果的详细信息
- **防抖优化**：避免频繁请求，提升性能
- **响应式设计**：适配不同屏幕尺寸
- **暗色主题支持**：自动适配暗色主题

## 使用方法

### 在文章管理页面

1. 点击工具栏中的"内容搜索"按钮
2. 在弹出的搜索框中输入关键词
3. 从搜索结果中选择要编辑的文章
4. 自动跳转到编辑页面

### 在草稿管理页面

1. 点击工具栏中的"内容搜索"按钮
2. 在弹出的搜索框中输入关键词
3. 从搜索结果中选择要编辑的草稿
4. 自动跳转到编辑页面

## 搜索范围

- **文章搜索**：搜索所有已发布的文章
- **草稿搜索**：搜索所有草稿内容
- **搜索字段**：标题、内容、分类、标签

## 技术实现

### 后端API

- **文章搜索**：`GET /api/admin/article/search?value=关键词`
- **草稿搜索**：`GET /api/admin/draft/search?value=关键词`

### 前端组件

- **组件路径**：`packages/admin/src/components/ContentSearchModal/`
- **主要文件**：
  - `index.jsx` - 组件主文件
  - `index.less` - 样式文件
  - `README.md` - 说明文档

## 集成指南

### 引入组件

```jsx
import ContentSearchModal from '@/components/ContentSearchModal';
```

### 使用组件

```jsx
<ContentSearchModal
  visible={showContentSearch}
  onCancel={() => setShowContentSearch(false)}
  type="article" // 或 "draft"
  onSelect={handleSearchSelect}
/>
```

### 参数说明

- `visible`: 是否显示搜索框
- `onCancel`: 关闭搜索框的回调
- `type`: 搜索类型，"article" 或 "draft"
- `onSelect`: 选择搜索结果的回调

## 更新日志

### v1.0.0
- 初始版本发布
- 支持文章和草稿的全文搜索
- 支持实时搜索和防抖优化
- 支持暗色主题 