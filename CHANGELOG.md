# Changelog
### [1.8.7](https://github.com/xxddccaa/vanblog/compare/v1.8.6...v1.8.7) (2026-09-07)

### Bug 修复

* **website:** 统一 Markdown 内容样式加载，修复代码块换行、折叠按钮与暗色主题样式冲突
* **website:** 清理代码块、图片缩放和侧栏滚动监听，修复页面切换后的重复绑定与延迟初始化
* **diagrams:** 修复 Mermaid 与通用图表主题切换的异步竞争，补齐 WaveDrom SVG 序列化、皮肤和图形展开
* **diagrams:** 清理图表重试后的旧错误提示，保留 WaveDrom 连线箭头和端点
* **release:** 同步部署示例版本，并校验其与根包版本一致

### [1.8.6](https://github.com/xxddccaa/vanblog/compare/v1.8.5...v1.8.6) (2026-09-05)


### 🐛 Bug Fixes | Bug 修复

* **website:** 修复动态卡片继承 Markdown 主题底部画布留白的问题，并统一首页摘要与动态卡片的嵌入式 Markdown 样式


### [1.8.5](https://github.com/xxddccaa/vanblog/compare/v1.8.4...v1.8.5) (2026-09-01)


### ⚡ Performance | 性能优化

* **server:** 下推 record-store JSONB 查询、文章搜索和相关文章评分，减少全量扫描与正文大字段读取
* **website:** 首页、动态和友链改用服务端 Markdown，页面数据并行加载并收口客户端重型依赖
* **admin:** 编辑器、Emoji 与统计标签改为按需加载，系统日志改为增量 tail/cursor
* **build:** mind-map 资源内容哈希化，all-in-one 镜像依赖层可复用

### 🐛 Bug Fixes | Bug 修复

* **auth:** 登录失败限制正确使用自定义次数、窗口和 TTL
* **storage:** 修复兼容查询不安全 OR 回退的 PostgreSQL 参数错位
* **admin:** 修复文章查询中特殊字符污染 URL 参数
* **release:** Docker Hub 继续使用宿主机代理时可清空构建容器代理，避免 loopback 代理导致包管理器断连

### [1.8.4](https://github.com/xxddccaa/vanblog/compare/v1.8.3...v1.8.4) (2026-08-31)


### 🐛 Bug Fixes | Bug 修复

* **markdown:** 新增 AgentObservatory 风格 Vanblog Plain 主题，修复暗色预览文字颜色、主题装饰残留和卡片底部空白

### [1.8.3](https://github.com/xxddccaa/vanblog/compare/v1.8.2...v1.8.3) (2026-08-27)


### 🐛 Bug Fixes | Bug 修复

* **markdown:** 统一支持 `\(...\)` / `\[...\]` 数学公式并保留公式后正文
* **deploy:** 修复 Docker 代理环境下健康检查和容器内部通信失败
* **docs:** 补充独立 all-in-one 测试环境的宿主机产物快速验证流程

### [1.8.2](https://github.com/xxddccaa/vanblog/compare/v1.8.1...v1.8.2) (2026-08-25)


### 🐛 Bug Fixes | Bug 修复

* **markdown:** 修复列表预览缩进与表格布局 ([128dc22](https://github.com/xxddccaa/vanblog/commit/128dc22cb4a3e211f3d547fb41561f53bd4752b7))

### [1.8.1](https://github.com/xxddccaa/vanblog/compare/v1.8.0...v1.8.1) (2026-08-12)


### 🐛 Bug Fixes | Bug 修复

* **website:** 修复 Markdown 主题首屏闪屏和样式残留 ([e9db49d](https://github.com/xxddccaa/vanblog/commit/e9db49dfe0eec71a031489d3f9781306dc634d41))
