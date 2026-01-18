---
title: 代码块折叠功能
icon: code
order: 10
---

## 功能说明

VanBlog 的代码块支持折叠/展开功能：

- **前台网站**：当代码块超过一定行数时，会自动折叠并显示"展开代码"按钮
- **后台编辑器**：代码块始终完全展开，不显示折叠按钮（方便编辑时查看完整代码）

## 技术实现

### 核心文件

```
packages/admin/src/components/Editor/plugins/codeBlock.tsx
```

### 实现原理

代码块插件 `customCodeBlock` 接受一个 `maxLines` 参数：

- 当 `maxLines >= 100000` 时，视为编辑器模式，完全禁用折叠功能
- 当 `maxLines < 100000` 时，代码超过指定行数会自动折叠

### 关键代码

```typescript
// 工厂函数：根据是否禁用折叠来生成不同的 rehype 插件
const createCodeBlockPlugin = (disableCollapse: boolean) => () => (tree) => {
  // ...
  // 只有非编辑器模式才添加展开/收起按钮
  if (!disableCollapse) {
    const codeToggleBtn = { /* ... */ };
    headerChildren.push(codeToggleBtn);
  }
  // ...
};

export function customCodeBlock(maxLines: number = 15): BytemdPlugin {
  // 如果 maxLines 很大（编辑器模式），完全禁用折叠功能
  const disableCollapse = maxLines >= 100000;

  return {
    rehype: (processor) => processor.use(createCodeBlockPlugin(disableCollapse)),
    // ...
  };
}
```

### 使用方式

```typescript
// 编辑器中使用（禁用折叠）
const EDITOR_CODE_MAX_LINES = 1000000;
customCodeBlock(EDITOR_CODE_MAX_LINES)

// 文档查看器/前台使用（启用折叠，超过15行折叠）
customCodeBlock(15)
```

## 修改经验

### 问题背景

原来的实现中，"展开代码"按钮元素在 HTML 生成阶段（rehype）就已经创建，即使后续通过 `viewerEffect` 设置 `display: none` 隐藏，也可能在页面渲染时短暂显示。

### 解决方案

将 `codeBlockPlugin` 改为工厂函数 `createCodeBlockPlugin(disableCollapse)`，在 HTML 生成阶段就根据模式决定是否创建折叠按钮元素，而不是先创建再隐藏。

### 关键点

1. **从源头解决**：在 rehype 阶段就不生成按钮，而不是生成后再隐藏
2. **参数传递**：通过闭包将 `disableCollapse` 参数传递给 rehype 插件
3. **阈值设计**：使用 `maxLines >= 100000` 作为判断条件，既保证编辑器不折叠，又为未来留有余地
