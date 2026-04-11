  # 博客 Cloudflare 缓存优先优化方案

  ## 概览

  基于当前代码，公开站已经有几块方向是对的，应该保留并扩展：

  - packages/website/components/PostCard/bottom.tsx 已经把“上一篇 / 下一篇”做成客户端异步请求，说明“主 HTML 稳定、碎片异步化”的路线是正确的。
  - packages/website/components/CategoryPage/index.tsx 和 packages/website/components/TimelinePage/index.tsx 已经是“摘要页 + 展开后独立请求文章列表”，这正适合复用到更多公共页。
  - packages/server/src/main.ts 已经把 rss、sitemap、search-index.json 当作静态产物对外提供，这也符合边缘缓存思路。

  当前最需要做的，不是继续堆 SSR，而是把“公开 HTML 的稳定性”和“Cloudflare 的缓存契约”彻底拉直：

  1. 让 Cloudflare 明确缓存 HTML；
  2. 把高频变化碎片彻底从主 HTML 中拆出去；
  3. 降低“新发一篇文章导致大量旧页失效”的联动面。

  ———

  ## A-C. 最影响 Cloudflare 命中率的 10 个点

  | 优先级 | 问题 | 为什么伤命中率 | 应改成什么 |
  |---|---|---|---|
  | 1 | 公开 HTML 目前没有形成对 Cloudflare 明确、稳定的缓存契约 | Cloudflare 默认不缓存 HTML/JSON；当前 next.config.js 主要靠 Surrogate-Control，而不是更适合 Cloudflare 的 Cloudflare-CDN-Cache-Control | 整页静态 + Cloudflare Cache
  Rules + Cloudflare-CDN-Cache-Control |
  | 2 | /、/page/* 仍是 offset 分页，activeArticleById() 每次文章变更都会触发全部 page 页重建 | 新文章会把旧文章整体往后推，导致整个分页链一起失效 | 低风险先保留；长期改成“首页实时 + 归档稳定页” |
  | 3 | 列表页每张卡片都会请求阅读量/访客量，评论数也在列表页出现 | 首页、分页页、分类页、标签页一次访问会触发 N 个碎片请求，虽然不是整页 miss，但会显著增加边缘到源站的碎片压力 | 列表页去掉这些碎片，详情页单独异步；或 批量 JSON 接口 |
  | 4 | 站点统计信息被塞进大量页面的主 HTML（AuthorCard、时间线/分类副标题） | 发文、改分类、改标签、字数变化都会让很多本该稳定的 HTML 变动 | 独立 JSON 接口 + 单独缓存 |
  | 5 | GET /api/public/article/:id 仍然走 getByIdOrPathnameWithPreNext() | 前后文虽然已不在 HTML 里，但主文章接口仍与 pre/next 耦合，增加查询与失效复杂度 | 文章主接口只返回文章 shell，/nav 单独接口 |
  | 6 | _app.tsx 每次路由切换都会发 pageview 写请求 | 这类请求天然不缓存，会持续穿透到源站 | 独立写入接口 + sendBeacon + Redis/队列缓冲 |
  | 7 | /moment、/nav 是高互动/高变动页面，但目前仍混在通用公开缓存策略里 | 它们会拉低整体缓存命中率预期，不适合和文章页同一 TTL 策略 | 单独缓存策略，必要时 HTML 降级为短 TTL |
  | 8 | sitemap / rss / feed / 搜索索引更新策略不统一 | 当前搜索索引会跟随文章更新，但 RSS / sitemap 更偏定时刷新，发布后边缘内容可能不够及时且不易定向 purge | 发布驱动生成静态产物 + 定向 purge |
  | 9 | Cloudflare 侧若不忽略营销参数 / cookie，会产生缓存碎片 | utm_*、fbclid、多余 cookie 会让同一页面在边缘变成多个缓存键 | 公开 HTML 统一 cache key，忽略追踪参数与匿名 cookie |
  | 10 | 标签页虽然已开始走客户端拉取，但模式还不统一 | 现在只有部分页面使用“稳定 shell + 异步数据”；热门文章、最新文章、相关文章等未来若继续进主 HTML，会再次放大联动失效 | 统一改成 稳定 HTML + 独立 JSON 碎片 方案 |

  ———

  ## D-F. 缓存分层、响应头与 Cloudflare 规则

  ### 1. HTML 页面缓存

  按页面分两层：

  - 稳定内容页：/post/*、/about、/link、/c/*
      - 浏览器：Cache-Control: public, max-age=0, must-revalidate
      - Cloudflare：Cloudflare-CDN-Cache-Control: public, s-maxage=604800, stale-while-revalidate=86400
      - ETag: 强 ETag，建议用 content-hash 或 updatedAt 派生
      - Last-Modified: 文章或页面自身的 updatedAt
      - 不返回 Set-Cookie
  - 半稳定列表页：/、/page/*、/category/*、/tag/*、/timeline
      - 低风险方案：s-maxage=300~3600
      - 长期方案：首页保留短 TTL，老归档页升到 s-maxage=86400~604800
  - 高互动页：/moment、/nav
      - 单独规则；/moment 建议短 TTL 或不缓存 HTML
      - /nav 可 5~15 分钟边缘缓存

  ### 2. JSON 接口缓存

  拆成三类：

  - 稳定碎片接口：/api/public/article/:id/nav、/api/public/site-stats、/api/public/timeline/summary、/api/public/category/summary
      - Cache-Control: public, max-age=60
      - Cloudflare-CDN-Cache-Control: public, s-maxage=3600~86400, stale-while-revalidate=86400
      - ETag + Last-Modified
  - 热点但高变碎片：阅读量、点赞数、评论数、热门文章、最新文章、相关文章
      - Cache-Control: public, max-age=15~60
      - Cloudflare-CDN-Cache-Control: public, s-maxage=60~300, stale-while-revalidate=300
      - 评论列表如果强调实时，可不走长缓存；评论数适合短 TTL
  - 搜索索引 / RSS / Sitemap
      - search-index.json: s-maxage=3600~86400
      - sitemap.xml / feed.xml / feed.json: s-maxage=3600~86400
      - 全都作为静态产物提供，发布后按标签 purge

  ### 3. 静态资源缓存

  - /_next/static/*: Cache-Control: public, max-age=31536000, immutable
  - 带内容 hash 的 /static/img/*、CSS、JS：同上
  - 固定路径资源如 favicon、logo：
      - 最好版本化路径
      - 若保持固定 URL，则不要继续按 1 年 immutable 对待

  ### 4. 后台 / API 绕过缓存

  直接 bypass：

  - /admin*
  - /api/admin/*
  - /api/comment*、/comment*
  - /ui*、/user*、/token*、/db*、/oauth*
  - 任何 POST/PUT/PATCH/DELETE
  - 任何带鉴权头的请求
  - 任何会返回 Set-Cookie 的请求

  ### 5. 建议统一响应头

  默认替换原则：

  - 弃用当前公开路径上的 Surrogate-Control
  - 改用：
      - Cache-Control：浏览器策略
      - CDN-Cache-Control：通用 CDN 策略，可选
      - Cloudflare-CDN-Cache-Control：Cloudflare 专用策略，优先
  - 保留 ETag
  - 补齐 Last-Modified
  - 不在公开页面使用 Vary: Cookie、Vary: User-Agent
  - 若采用 Cloudflare 精准 purge，给 HTML / JSON 加 Cache-Tag

  ### 6. Cloudflare 规则建议

  按优先顺序配置：

  1. Bypass 规则
      - /admin*
      - /api/admin/*
      - Waline 相关路径
      - 非 GET/HEAD
  2. 公开 HTML Cache Everything
      - 匹配 /、/post/*、/page/*、/category*、/tag*、/timeline、/about、/link、/c/*
      - Edge TTL 先 respect origin；若短期内不改代码，再临时 override
  3. 公开 JSON 碎片缓存
      - 仅允许 /api/public/* 中的读接口
      - 对搜索、写入、鉴权接口单独 bypass
  4. 高波动页面单独规则
      - /moment*、/nav*
  5. 缓存键收敛
      - 忽略 utm_*、fbclid、gclid 等追踪参数
      - 匿名公共页忽略 cookie
      - 若套餐不支持自定义 cache key，则用 Worker 或 URL 规范化跳转实现
  6. 可选增强
      - 开启 Tiered Cache
      - 开启 Respect Strong ETags
      - 用 Cache Analytics 盯命中率与源站回源路径

  ———

  ## G-H. 最小改造方案 vs 最佳改造方案

  ### 最小改造方案（低风险，优先落地）

  目标：不改 URL 体系，不动 SEO 主体，只把最明显的缓存杀手拆掉。

  - 把 packages/website/next.config.js、服务端公开接口缓存头、静态产物缓存头统一改成 Cloudflare-CDN-Cache-Control 体系
  - Cloudflare 上补齐“公开 HTML Cache Everything + 后台/API bypass”规则
  - 保留文章正文 SSG / ISR，不动正文渲染方式
  - 列表页移除阅读量 / 访客量 / 评论数：
      - 首页
      - /page/*
      - /category/*
      - /tag/*
      - 时间线展开列表
  - 文章详情页保留这些碎片，但全部走独立接口异步加载
  - GET /api/public/article/:id 改为只返回文章本体；pre/next 继续留在 /nav
  - AuthorCard 统计、页面副标题统计改为 site-stats 碎片接口
  - 在文章 create / update / delete 时，同步触发：
      - search-index
      - rss
      - sitemap
      - 对应 cache-tag / URL purge
  - 结果：
      - 文章页 HTML 稳定度高
      - 列表页少掉大量碎片请求
      - Cloudflare 能真正缓存 HTML

  ### 最佳改造方案（长期最优）

  目标：发新文章时，尽量只影响首页、少量标签/分类入口页和新文章页。

  - 把公开站拆成两种页面：
      - 实时入口页：/、分类/标签首页
      - 稳定归档页：按年/月或其它稳定分桶的 archive 页
  - 逐步弱化当前 offset 分页在 SEO 中的角色：
      - 首页仍保留静态首屏文章列表
      - 深层列表转归档页或稳定 bucket 页
      - 分类/标签详细列表不再让“新增一篇文章”重排整条分页链
  - 所有高频动态块统一改为 fragment API：
      - 上一篇 / 下一篇
      - 阅读量 / 点赞数 / 评论数
      - 评论列表
      - 相关文章 / 推荐文章 / 热门文章 / 最新文章
      - 标签统计 / 分类统计
      - 首页侧边栏动态模块
  - 文章详情页只保留：
      - title
      - publish/update 时间
      - category
      - tags
      - 正文 HTML
      - canonical / schema / SEO meta
  - 引入 Cache-Tag：
      - post:{id}
      - home
      - tag:{name}
      - category:{name}
      - site-stats
      - artifact:rss
      - artifact:sitemap
      - artifact:search-index
  - 阅读量/点赞等写入改成队列或 Redis 聚合后刷库，公开读接口只读聚合结果
  - 结果：
      - 新文章发布后，旧文章详情页基本不失效
      - 首页和少数入口页变化，旧 archive 页长期稳定
      - Cloudflare 命中率接近“内容站最佳实践”

  ———

  ## I. 明确的代码重构方案与修改顺序

  ### 第一阶段：先把缓存契约改对

  - 修改 packages/website/next.config.js
      - 公开 HTML 不再依赖 Surrogate-Control
      - 改为 Cache-Control + Cloudflare-CDN-Cache-Control
  - 修改服务端公开接口和静态产物头逻辑
      - 统一从 packages/server/src/main.ts
      - 以及公开 API 缓存中间件出发
  - 补充自动化断言：
      - 公开 HTML 无 Set-Cookie
      - 公开 HTML / JSON 有明确缓存头
      - 管理端 / 写接口为 no-store

  ### 第二阶段：把文章页主 HTML 与动态碎片彻底解耦

  - 调整公开文章接口：
      - /api/public/article/:id 只返回文章 shell
      - /api/public/article/:id/nav 保留上一篇 / 下一篇
      - 新增 /api/public/article/:id/engagement
  - 前端文章页只用 shell 参与 SSG
  - 详情页用独立请求拉：
      - nav
      - viewer / visited
      - commentCount
      - likeCount（若后续加）
  - 列表页彻底不渲染这些数据

  ### 第三阶段：把全站统计和侧边栏从主 HTML 拆走

  - 新增 /api/public/site-stats
      - postNum
      - tagNum
      - categoryNum
      - totalWordCount
  - AuthorCard、时间线/分类副标题都改为读取该接口
  - 首页侧边栏若后续有“热门文章 / 最新文章 / 标签云”，全部按 fragment API 处理

  ### 第四阶段：修正发布后的失效链路

  - 在文章变更后：
      - 保持当前“当前文章 + 相关标签/分类”的定向刷新
      - 增加 RSS / sitemap / search-index 产物刷新
  - 如果仍保留 offset 分页：
      - 先接受 /page/* 的联动失效
  - 若进入长期方案：
      - 新增 archive 路由
      - 将深分页迁移为稳定归档页
      - 缩小文章发布后的 purge 面

  ### 第五阶段：把高频写请求与公开读流量分离

  - pageview 写入改为 sendBeacon
  - 源站侧做 Redis/内存聚合 + 定时刷库
  - 公开读取用只读聚合接口，并给短 TTL
  - 评论数单独缓存，评论列表不进入主 HTML

  ———

  ## 测试与验收

  - 响应头测试
      - 公开 HTML 返回 Cache-Control 与 Cloudflare-CDN-Cache-Control
      - 公开 HTML/JSON 不返回 Set-Cookie
      - 管理端与写接口为 no-store
  - 页面稳定性测试
      - 修改阅读量 / 评论数 / 点赞数后，文章页 HTML 不变
      - 修改上一篇/下一篇关系后，文章页 HTML 不变
  - 碎片请求测试
      - 首页访问时不再对每篇文章发 viewer/comment 读请求
      - 文章详情页只发少量碎片请求
  - 失效范围测试
      - 发布新文章后，旧文章详情页缓存标签不失效
      - 受影响的仅为：首页、新文章页、相关 tag/category 入口页、相关产物
  - 产物测试
      - 发布后 search-index.json、sitemap.xml、feed.xml 会刷新
  - Cloudflare 验收
      - 公开文章页命中 HIT
      - 首页命中率明显提升
      - 源站 /api/public/article/viewer/*、Waline 读接口请求量下降

  ———

  ## 假设与默认决策

  - 公开站继续保持匿名访问，不在公共页引入登录态分支。
  - SEO 仍以服务端输出正文 HTML 为核心，不接受文章正文改纯客户端渲染。
  - “上一篇 / 下一篇、阅读量、点赞数、评论、推荐、热门、最新、相关文章、统计模块”全部视为非首屏 SEO 核心，默认拆出主 HTML。
  - 低风险方案不改现有 URL 体系；长期最优方案允许新增 archive 路由，并逐步降低 offset 分页的重要性。
  - 若 Cloudflare 套餐不支持理想的自定义 cache key，则用 Worker 或 URL 规范化替代。
  - 公开缓存策略以 Cloudflare 为第一优先级，而不是浏览器缓存为第一优先级。

  ———

  ## 参考基线

  - Cloudflare 默认不缓存 HTML/JSON，公开 HTML 需要 Cache Rules：https://developers.cloudflare.com/cache/concepts/default-cache-behavior/ (https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)
  - Cloudflare 推荐用 CDN-Cache-Control / Cloudflare-CDN-Cache-Control 管边缘缓存；Surrogate-Control 会影响 Cache-Control 解释：https://developers.cloudflare.com/cache/concepts/cdn-cache-control/
    (https://developers.cloudflare.com/cache/concepts/cdn-cache-control/)
  - Cloudflare Cache Rules 能按路径设置 Edge TTL / Browser TTL / Cache Key：https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ (https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
  - Cloudflare 支持 Cache-Tag 做定向 purge：https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/ (https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/)
  - Cloudflare 对 ETag / revalidation 的行为说明：https://developers.cloudflare.com/cache/reference/etag-headers/ (https://developers.cloudflare.com/cache/reference/etag-headers/) 、https://developers.cloudflare.com/cache/concepts/re
    validation/ (https://developers.cloudflare.com/cache/concepts/revalidation/)
