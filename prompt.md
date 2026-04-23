# VanBlog 后台编辑器从 ByteMD 迁移到 Milkdown 的开发方案

你要在 VanBlog 仓库中，把后台管理端的 Markdown 编辑器从 ByteMD 迁移为 Milkdown。以下方案是**实现用规范**，目标是让执行者不再做额外产品决策，直接按此方案实施。

## 1. 目标与边界

### 目标
- 仅替换 `packages/admin` 中后台编辑器的编辑引擎。
- 保持数据库、接口、前台渲染、导入导出格式仍然以 **Markdown 字符串** 为唯一真值。
- 保证历史文章/草稿/关于页/动态/文档在 Milkdown 中打开、保存后，不破坏既有 Markdown 语法与前台显示。
- 在过渡期保留 ByteMD fallback，先实现双引擎切换，再把默认值切到 Milkdown。

### 明确不做
- 不改服务端存储结构。
- 不改 `packages/website` 的渲染链路；前台仍按现有 Markdown 渲染方案工作。
- 不直接修改 `/root/vanblog/milkdown` 源码；它只作为参考，不作为仓库内 workspace 包接入。
- 第一版不要求在编辑区内完成所有高级可视化（例如 Mermaid 实时图形化编辑），优先保证 Markdown round-trip 正确。

## 2. 现状结论

### 当前后台编辑器位置
- 页面业务：`packages/admin/src/pages/Editor/index.jsx`
- ByteMD 编辑器实现：`packages/admin/src/components/Editor/index.tsx`
- 文档预览组件：`packages/admin/src/components/DocumentViewer/index.jsx`

### 当前已绑定在 ByteMD 上的能力
- GFM、数学公式、Mermaid、代码高亮
- 图片上传、剪贴板图片上传
- Emoji、撤销/重做
- 插入 `<!-- more -->`
- 自定义容器 `:::info / :::note / :::warning / :::danger / :::tip`
- 原始 HTML
- 代码块增强（复制、折叠、自动换行、智能代码块）
- Mermaid 导出
- 暗色主题与 `.bytemd` / `.CodeMirror` 专属样式

### Milkdown 本地源码已确认可用的能力
- React 集成：`@milkdown/react`
- 高层编辑器：`@milkdown/crepe`
- 可组合构建：`CrepeBuilder`
- Markdown 变更监听：`listener.markdownUpdated`
- 图片上传：`@milkdown/plugin-upload`
- GFM / history / clipboard / table / latex / toolbar / top-bar 等能力

## 3. 总体设计决策

### 3.1 核心原则
- **Markdown 字符串是唯一真值**。
- 编辑器内部可以是 ProseMirror/Milkdown state，但对外 props、保存接口、缓存、导入导出都继续使用 Markdown 字符串。
- 编辑器替换优先做到“兼容现有内容”，其次才是“追求新交互”。

### 3.2 迁移路线
采用“三层结构 + 双引擎过渡”：

1. 新建统一编辑器抽象层 `MarkdownEditor`
2. 保留现有 ByteMD 实现作为 `bytemd engine`
3. 新增 Milkdown 实现作为 `milkdown engine`
4. 页面先接统一接口，不直接依赖具体引擎
5. 通过临时引擎开关完成灰度验证
6. 稳定后默认切到 Milkdown
7. 最后删除 ByteMD 依赖和旧实现

### 3.3 为什么不直接硬切
因为 ByteMD 当前不仅是一个输入框，而是承载了 VanBlog 自定义语法和工具栏能力。特别是以下内容若不专项处理，最容易保存后被破坏：
- `<!-- more -->`
- `:::info ... :::` 自定义容器
- 原始 HTML / iframe / script
- Mermaid fenced code block
- 智能代码块插入逻辑

因此必须先做抽象层与兼容层，再做引擎替换。

## 4. 实施方案

### 阶段 A：建立统一编辑器抽象层

#### 要做的事
新增统一组件，建议结构如下：
- `packages/admin/src/components/MarkdownEditor/index.tsx`
- `packages/admin/src/components/MarkdownEditor/types.ts`
- `packages/admin/src/components/MarkdownEditor/engines/bytemd.tsx`
- `packages/admin/src/components/MarkdownEditor/engines/milkdown.tsx`
- `packages/admin/src/components/MarkdownEditor/toolbar/*`

#### 对外接口固定为
```ts
type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  themeConfig?: MarkdownThemeConfig;
  codeMaxLines?: number;
};
```

#### 实施要求
- 先把当前 `components/Editor/index.tsx` 包装到 `engines/bytemd.tsx`，尽量不改旧逻辑。
- `pages/Editor/index.jsx` 改为只依赖新的 `MarkdownEditor` 抽象层。
- 引擎选择先用**本地开关**实现，默认值先保持 `bytemd`，开关来源固定为：
  - `localStorage.vanblog_editor_engine`
  - 允许值：`milkdown` / `bytemd`
  - 无值时默认 `bytemd`
- 页面现有保存、删除、导入导出、localStorage 缓存、Ctrl/Cmd+S 逻辑不改行为。

### 阶段 B：实现 Milkdown 最小可用版

#### 技术选型
- 使用 `@milkdown/react` + `CrepeBuilder`
- 不直接依赖完整默认 Crepe UI 作为最终产品 UI
- Milkdown 只负责编辑区；VanBlog 自己实现工具栏和外层布局

#### Milkdown 编辑器实现要求
- 进入页面时使用外部 `value` 初始化内容
- 使用 `listener.markdownUpdated` 持续把 Markdown 回传给 `onChange`
- 外部 `value` 更新时，只有在与当前 editor markdown 不一致时才做程序化同步，避免光标抖动和死循环
- 卸载时销毁 editor 实例
- 支持只读/加载状态预留，但第一版先按可编辑实现

#### 第一批必须接入的内建能力
- GFM
- history（撤销/重做）
- clipboard
- table
- link
- list
- heading
- bold / italic / strikethrough / inline code
- latex/math
- image upload

### 阶段 C：自定义 VanBlog 工具栏

#### 决策
不要把 Crepe 默认 toolbar/top-bar 直接作为最终界面。改为：
- VanBlog 自己渲染工具栏
- 点击按钮时调用 Milkdown command 或插入 Markdown 片段

#### 第一版工具栏必须具备
- 撤销 / 重做
- 标题
- 加粗 / 斜体 / 删除线 / 行内代码 / 链接
- 引用
- 无序列表 / 有序列表 / 任务列表
- 代码块
- 数学公式
- 表格
- 图片上传
- 插入 `more`
- 插入自定义容器
- Emoji

#### 交互要求
- 工具栏文案保持中文
- 不引入额外产品配置项
- 快捷键保留页面级 `Ctrl/Cmd+S`
- 智能代码块按钮继续保留“记住上次代码语言”的 localStorage 行为

### 阶段 D：语法兼容策略

#### 4.1 `<!-- more -->`
- 存储格式仍然固定为 `<!-- more -->`
- 第一版先作为“插入固定 Markdown 片段”实现，不强制做自定义节点可视化
- 保存时必须原样保留
- 页面里现有“缺少 more 标记”的保存提示逻辑不变

#### 4.2 自定义容器 `:::info ... :::`
- 第一版继续通过工具栏插入完整模板文本
- 必须保证 round-trip 不丢失 title 和容器类型
- 预览表现继续沿用现有渲染链验证，不在第一版要求编辑区结构化可视化

#### 4.3 Mermaid
- 第一版把 Mermaid 继续视为 fenced code block：` ```mermaid `
- 不要求在编辑区里实时渲染图表
- 右侧/下方预览继续使用现有 Mermaid 渲染逻辑
- Mermaid 导出按钮继续挂在预览区，而不是编辑区内部

#### 4.4 原始 HTML / iframe / script
- 这是最高风险项，必须以“原文保真”为最高优先级
- 第一版不做富节点编辑，优先确保导入、编辑、保存后 Markdown 原文不丢失、不重排、不被错误转义
- 预览仍走现有 safe/sanitize 策略

#### 4.5 图片上传
- 复用现有 `uploadImg` 网络逻辑
- 三种入口都必须保留：
  - 工具栏上传
  - 粘贴图片
  - 拖拽图片
- 输出仍然写回 Markdown 图片语法

#### 4.6 Emoji
- 第一版不强依赖 Milkdown 内建 emoji/slash 能力
- 复用当前 emoji 选择器，点击后向当前光标插入 emoji 字符

#### 4.7 代码块增强
- 编辑区第一版只保留“插入代码块 + 记忆上次语言”
- 代码块复制、折叠、自动换行继续保留在预览侧
- 不要求第一版把 ByteMD 预览增强原样搬到编辑区内部

### 阶段 E：预览策略

#### 决策
第一阶段**不替换预览渲染链**。

#### 实施要求
- `packages/admin/src/components/DocumentViewer/index.jsx` 先继续沿用现有渲染方案
- 编辑器的预览区域也继续复用现有 Markdown Viewer 逻辑
- 迁移时只替换“写”的引擎，不替换“看”的引擎

#### 目的
- 减少一次性风险
- 用现有预览来验证 Milkdown 输出的 Markdown 是否与当前渲染链兼容
- 前台渲染行为不受这次迁移影响

### 阶段 F：样式重构

#### 样式原则
现有样式大量绑定 `.bytemd` 和 `.CodeMirror`，不能简单改类名复用。必须新建一套 Milkdown 样式。

#### 实施要求
- 新建以 `.vb-milkdown-editor` 为根的样式体系
- 继续复用 admin 已有 CSS 变量：`--admin-editor-*`
- 样式拆成三层：
  - 外层布局
  - 工具栏
  - ProseMirror/Milkdown 内容区

#### 第一版必须覆盖
- 编辑区背景、边框、圆角、阴影、滚动条
- 深浅色模式文本、链接、标题、选区
- 代码块、表格、图片、blockquote、task list
- 工具栏 hover / active / disabled
- focus 状态与光标可见性

### 阶段 G：依赖迁移

#### 第一阶段新增但不删除
在 `packages/admin/package.json` 中先增加：
- `@milkdown/react`
- `@milkdown/crepe`
- `@milkdown/kit`

如实现时发现聚合出口不够，再补充：
- `@milkdown/plugin-upload`
- `@milkdown/plugin-listener`

#### ByteMD 依赖处理方式
第一阶段先保留以下依赖，不立即删除：
- `@bytemd/react`
- `bytemd`
- `@bytemd/plugin-*`

等默认引擎切换到 Milkdown 且验证稳定后，再删除旧依赖和旧实现。

## 5. 分阶段交付要求

### 里程碑 1：双引擎壳完成
完成标准：
- 页面通过统一组件接入编辑器
- `localStorage.vanblog_editor_engine` 可切换 ByteMD/Milkdown
- 默认仍为 ByteMD
- 页面保存、缓存、导入、导出逻辑行为不变

### 里程碑 2：Milkdown 最小可编辑
完成标准：
- `article / draft / about / moment / document` 五种类型都能打开、编辑、保存
- Markdown 能从外部 value 灌入
- 用户编辑能持续回写 `onChange`
- local cache 恢复有效
- 导出 Markdown 仍兼容现有格式

### 里程碑 3：VanBlog 特有语法兼容
完成标准：
- `<!-- more -->` round-trip 正确
- `:::info` 等容器 round-trip 正确
- Mermaid fenced block round-trip 正确
- 原始 HTML / iframe round-trip 正确
- Emoji、图片上传、智能代码块恢复可用

### 里程碑 4：切默认值
完成标准：
- 默认引擎切到 Milkdown
- ByteMD 保留为 fallback 至少一个版本周期
- 文档更新完成

### 里程碑 5：移除 ByteMD
完成标准：
- 删除旧实现与旧依赖
- 清理无用样式与测试断言
- 保持回归测试通过

## 6. 测试方案

### 单元测试
必须新增或更新以下测试：
- Markdown round-trip：
  - `<!-- more -->`
  - `:::info{title="相关信息"}`
  - Mermaid fenced block
  - `$...$` / `$$...$$`
  - 原始 HTML / iframe
  - 图片 Markdown
- 工具栏插入动作：
  - 插入 more
  - 插入容器
  - 插入代码块
  - 插入 emoji
- 受控同步：
  - `value -> editor`
  - `editor -> onChange`
  - 外部 value 更新不出现死循环

### 组件/集成测试
- 缓存恢复后内容一致
- 保存后页面状态与原逻辑一致
- 切换引擎不影响导入导出
- 深色模式下编辑器能正常渲染与输入

### 回归测试
更新后台 smoke 测试，重点验证：
- 编辑器页面能打开
- 能看到保存按钮和编辑区
- 深色模式仍生效
- 代码块/预览仍可用
- 核心页面：article、draft、about、moment、document

### 手工验收
优先按仓库现有 host-debug 方案验证：
- `pnpm host:dev:up`
- 重点验证 `/editor` 各 type 页面
- 若涉及 `/admin` 子路径、静态资源或容器行为，再用 `18080` Docker 流程复验

## 7. 实施细则与默认决策

### 默认决策
- 默认先只替换后台 admin 编辑器，不碰 website 和 server。
- 默认继续沿用现有预览渲染链，不把 DocumentViewer 一起迁到 Milkdown。
- 默认继续使用 Markdown 字符串作为唯一存储格式。
- 默认优先兼容旧内容，不为第一版引入新的 Markdown 方言。
- 默认不直接接入完整 Crepe 默认 UI，而是自定义 VanBlog 工具栏。
- 默认保留 ByteMD fallback，直到 Milkdown 稳定。

### 必须避免的实现方式
- 不要把编辑器内部 JSON/state 直接作为保存格式
- 不要在第一版同时重构前台渲染链
- 不要直接删除 ByteMD 逻辑后再补兼容
- 不要在没有 round-trip 测试的情况下处理 raw HTML / custom container / more / mermaid

## 8. 最终验收标准

满足以下条件才算迁移完成：
- 后台默认编辑器为 Milkdown
- 文章、草稿、关于、动态、文档五类内容可稳定编辑和保存
- 历史 Markdown 内容在打开并保存后不破坏特殊语法
- 图片上传、emoji、插入 more、自定义容器、数学公式、代码块、Mermaid 预览能力可用
- 深浅色样式可用，编辑体验不明显退化
- ByteMD 相关代码和依赖被安全清理，回归测试通过



测试目录/root/vanblog/test-env-vanblog

本地网络代理端口是10829，当网络不好或者网络不通，可以使用网络代理来加速构建。




在上一轮修改里，已经完成了这些:

   这次已经完成的代码改动集中在 admin 编辑器迁移骨架上：
   - 新增统一抽象层 [packages/admin/src/components/MarkdownEditor/index.tsx](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/index.tsx:1)，页面入口 [packages/admin/src/pages/Editor/index.jsx](/root/vanblog/vanblog_git/vanblog/packages/admin/src/pages/Editor/index.jsx:1) 已切到这个抽象层。
   - 保留 ByteMD fallback，并把旧入口 [packages/admin/src/components/Editor/index.tsx](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/Editor/index.tsx:1) 收成兼容导出。
   - 新增 Milkdown 主实现 [packages/admin/src/components/MarkdownEditor/engines/milkdown.tsx](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/engines/milkdown.tsx:1)，包含受控 Markdown 同步、自定义工具栏、图片上传入口、emoji/more/容器/代码块/表格/公式插入，以及继续复用 `DocumentViewer` 的预览面板。
   - 新增样式和辅助模块：[packages/admin/src/components/MarkdownEditor/index.less](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/index.less:1)、[types.ts](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/types.ts:1)、[utils.ts](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/utils.ts:1)、[sync.ts](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/sync.ts:1)、[plugins/customContainer.ts](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/plugins/customContainer.ts:1)、[toolbar/Toolbar.tsx](/root/vanblog/vanblog_git/vanblog/packages/admin/src/components/MarkdownEditor/toolbar/Toolbar.tsx:1)。
   - 更新了 admin smoke 断言 [packages/admin/tests/current-stack.smoke.cjs](/root/vanblog/vanblog_git/vanblog/packages/admin/tests/current-stack.smoke.cjs:319)，让它识别新的 Milkdown 编辑器 DOM，同时兼容 ByteMD fallback。
   
   我能实际验证的只有不依赖 Milkdown 包安装的部分：
   - 通过：`node --test --experimental-strip-types tests/admin-markdown-editor.unit.test.mjs`
   - 通过：`node --check packages/admin/tests/current-stack.smoke.cjs`
   - 通过：`graphify update .`
   
   当前阻塞点有两个，都是环境级的，不是代码逻辑级的：
   - `pnpm install` 失败，npm registry DNS 解析报 `EAI_AGAIN`，所以 `@milkdown/react`、`@milkdown/crepe`、`@milkdown/kit` 还没有实际装进工作区。
   - `packages/admin` 现有脚本里的 `max test` 在这个仓库状态下不可用，直接报 `Invalid command test`，所以原生 admin 组件测试链路本身也没法作为验证入口。
   
   因此这次我不能诚实地给出“已完成开发和测试”的结论；代码迁移骨架和大部分实现已经写好，但还缺最后一段关键验证：
   1. 让环境能成功安装 Milkdown 依赖。
   2. 跑 `pnpm --filter @vanblog/admin tsc` 和 admin/stack smoke。
   3. 在 `18080` host-debug 或 Docker 流程下手工验证 article、draft、about、moment、document 五类编辑页。

我本地的milkdown代码只是给你的参考，你可以搜索一下milkdown如何使用和如何接入。网络问题抛出来我给你解决，但你要尝试使用10829的代理。

