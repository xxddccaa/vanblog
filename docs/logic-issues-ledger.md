# VanBlog 逻辑问题台账

> 本文件用于记录代码审计中发现的业务与部署逻辑问题。台账中的“建议修复方向”不是已经完成的改动；关闭问题时应补充修复提交和回归测试。

## 审计基线

- 审计日期：2026-08-13
- 代码版本：`v1.8.1`
- Git 基线：`master@377a32b9d65f57f22019471904544e0b6b4e6d33`
- 审计范围：`packages/server`、`packages/admin`、`packages/website`、根目录及 `docker/` 下的运行与代理配置
- 审计方式：静态走查、针对性最小复现、现有单元测试与部署断言
- 本轮原则：只登记问题，不修改产品逻辑

本轮基线验证：

| 命令 | 结果 |
| --- | --- |
| `pnpm test:deploy` | 21/21 通过 |
| `pnpm --filter @vanblog/theme-default exec vitest run` | 46 个测试文件、184 个测试通过 |
| `pnpm --filter @vanblog/server exec jest --runInBand` | 82 个测试套件、404 个测试通过 |

说明：现有测试全部通过不代表下列边界条件已被覆盖；多条问题正是缺少失败路径、类型边界或破坏性操作保护的测试。

## 状态与严重度定义

### 状态

- **已确认**：已由代码路径和最小复现确认，或静态证据足以确定行为。
- **待验证**：存在明确风险信号，但尚未完成生产等价复现或影响范围确认。
- **已验证非问题**：完成核对后确认属于显式设计行为，保留记录以避免重复审计。
- **已修复**：产品代码已修复且已补回归测试；应同时记录修复提交。

### 严重度

- **P1**：可能造成不可恢复的数据丢失、站点不可用或后台错误报告成功。
- **P2**：影响核心功能正确性、配置契约或缓存一致性，但通常可恢复或影响范围受限。
- **P3**：低频、遗留路径或影响较轻的问题。

## 已确认问题

### L-001：遗留单镜像的 Atom 路由未正确重写

- **严重度**：P2
- **状态**：已确认
- **模块/位置**：
  - `CaddyfileTemplate:82-84`
  - `CaddyfileTemplateLocal:53-55`
  - `caddyTemplate.json` 中 `/atom.xml` 的 `uri_substring`
  - 根 `Dockerfile:123-129`、`entrypoint.sh:12-13`
- **触发条件**：使用根 `Dockerfile` / `entrypoint.sh` 所代表的遗留单镜像运行路径，并请求 `/atom.xml`。
- **实际行为**：

  ```caddy
  handle /atom.xml {
    uri replace /feed.xml /rss/atom.xml
  }
  ```

  当前请求路径是 `/atom.xml`，被查找替换的字符串却是 `/feed.xml`，所以 URI 保持 `/atom.xml`，不会转到服务端实际生成的 `/rss/atom.xml`。
- **影响**：该部署路径上的 Atom Feed 可能返回前台页面、404 或其他非预期内容，订阅客户端无法正确读取 Atom 文件。
- **证据**：`RssProvider` 将 Atom 文件写入 `rss/atom.xml`；同仓库的新 split、当前 all-in-one 与 host-debug Caddy 配置均使用正确的 `uri replace /atom.xml /rss/atom.xml`。
- **范围说明**：不影响 `docker/caddy/Caddyfile`、`docker/caddy/Caddyfile.https`、`docker/all-in-one/Caddyfile` 和 `tests/host-dev/Caddyfile`。
- **建议修复方向**：统一遗留模板及生成的 JSON 配置，并为所有受支持 Caddy 入口增加 `/atom.xml -> /rss/atom.xml` 的部署断言。

### L-002：登录失败限制忽略已定义的次数和时长配置

- **严重度**：P2/P3
- **状态**：已修复
- **模块/位置**：
  - `packages/server/src/provider/auth/login.guard.ts:26-70`（修复前）
  - `packages/server/src/provider/auth/login.guard.ts:28-82`（修复后）
  - `packages/server/src/types/setting.dto.ts:53-58`
  - `packages/server/src/provider/setting/setting.provider.ts:291-304`
- **触发条件**：将 `enableMaxLoginRetry` 开启，并将 `maxRetryTimes` 或 `durationSeconds` 设置为非默认值。
- **实际行为**：Guard 只读取开关，判断逻辑始终使用硬编码的 `diff > 60` 和 `count >= 3`，错误信息也固定为“请一分钟之后再试”。
- **期望行为**：使用 `maxRetryTimes` 与 `durationSeconds` 决定阈值、窗口和提示。
- **影响**：
  - 管理端/API 保存的安全配置不生效，形成错误的配置契约。
  - 站点管理员可能误以为已收紧登录保护，实际仍按 3 次/60 秒运行。
- **最小复现**：使用 `{ enableMaxLoginRetry: true, maxRetryTimes: 1, durationSeconds: 10 }` 连续调用 Guard；第 1～3 次仍被允许，第 4 次起才拒绝。
- **建议修复方向**：规范化并校验配置值，改用 Redis 原子计数与配置 TTL，按配置生成提示；增加自定义阈值、窗口过期、成功登录清零和并发请求测试。
- **修复记录**：
  - 修复日期：2026-08-28（工作区改动，尚未提交）
  - 改动内容：Guard 现在读取并归一化 `maxRetryTimes` / `durationSeconds`（非正数、`NaN`、空值回退到 3 / 60，接受 API 未校验的数字字符串），用配置值判断阈值与窗口，提示文案改为 `请 ${durationSeconds} 秒之后再试`，并按 `durationSeconds` 给计数器写入 TTL（此前 `set()` 不带 TTL，内存后端的每 IP 记录不会过期）。
  - 附带修正：计数器被写成非数字（旧记录或 Redis 脏值）时，原实现 `count + 1` 会得到字符串并使 `count >= 阈值` 永久为假，等于静默关闭限流；现在读取时归一化为 0 并重开窗口。`lastLoginTime` 非法时也按窗口过期处理，避免永久锁死。
  - 回归测试：`packages/server/src/provider/auth/login.guard.spec.ts`（11 例，覆盖更严/更宽阈值、数字字符串配置、窗口内持续拒绝、窗口过期重置、提示文案含配置秒数、TTL、非法配置回退默认、脏计数器不失效、开关关闭与无配置放行）。修复前 9 失败 2 通过，修复后 11 通过。
  - 验证命令：`npx jest src/provider/auth/login.guard.spec.ts` 11/11；`npx jest --maxWorkers=4` 83 套件 / 427 测试全通过；`npx tsc --noEmit -p tsconfig.json` 无错误。
  - **残余风险**：成功登录清零由 `auth.controller.ts:40-50` 的 `clearLoginRetryCounter()` 负责，本次未改。计数仍是「读取后写回」，并发登录请求可能基于同一快照互相覆盖，实际放行次数可略多于配置；建议方向中的 Redis 原子计数（`cacheProvider.incrementWithTtl`）与并发测试未实施，需要时应另立条目。

### L-003：初始化失败会留下无法重新初始化的半成品状态

- **严重度**：P1/P2
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/provider/init/init.provider.ts:76-179`
  - `packages/server/src/controller/admin/init/init.controller.ts:53-67`
- **触发条件**：管理员写入成功后，Meta 双写或菜单写入等后续步骤抛错。
- **实际行为**：初始化按“管理员 -> Meta -> 菜单”顺序逐步写入，没有事务或补偿回滚；`checkHasInited()` 只检查 `id=0` 的管理员是否存在。
- **影响**：
  - 接口返回“初始化失败”，但管理员记录已经存在。
  - 后续 `/init/check` 返回已初始化，`POST /init` 又会因“已初始化”被拒绝。
  - Meta、菜单和 record-store / 结构化表可能只完成一部分，站点进入半初始化状态。
- **最小复现**：让 `structuredDataService.upsertMeta()` 抛错；结果为接口异常、管理员仍存在、`checkHasInited()` 为 `true`、菜单更新未执行。
- **建议修复方向**：将初始化改成可提交的单一状态机或数据库事务；至少在失败时补偿删除本次新建数据，并让“已初始化”同时验证管理员、Meta 和必要设置。另需为初始化过程增加互斥保护，见候选 C-001。

### L-004：文章变更未清理服务端归档缓存

- **严重度**：P2
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/provider/public-data-cache/public-data-cache.provider.ts:16-27`
  - `packages/server/src/controller/public/public.controller.ts:317-355`
  - `packages/server/src/controller/public/public.controller.ts:726-780`
  - `packages/server/src/controller/public/public.controller.ts:907-960`
  - `packages/server/src/provider/isr/isr.provider.ts:461-463`
- **触发条件**：归档 API 已进入 Redis/内存缓存后，创建、删除文章，或修改文章的时间、分类、标签、隐藏状态等归档相关字段。
- **实际行为**：`clearArticleRelatedData()` 会清 Meta、时间线、文章片段、标签和分析缓存，但没有清理：

  ```text
  public:archive:summary
  public:archive:${year}:${month}
  public:category:archive:summary:${category}
  public:category:archive:${category}:${year}:${month}
  public:tag:archive:summary:${tag}
  public:tag:archive:${tag}:${year}:${month}
  ```

- **影响**：归档摘要和月份文章 API 可在文章变更后继续返回旧数据，当前 TTL 为 300 秒。Cloudflare Cache-Tag purge 只处理边缘缓存，不能删除服务端 Redis/内存中的这些键。
- **证据**：上述键均由 `getCachedPublicPayload(..., 300, ...)` 写入；文章增删改入口最终只调用 `clearArticleRelatedData()`。
- **建议修复方向**：在文章相关清理中加入 `public:archive*`、`public:category:archive*`、`public:tag:archive*` 模式，或基于变更前后文章精确删除受影响键；增加“先预热缓存、再变更文章、随后立即读取”的回归测试。

### L-005：文章 ID 维护工具会无条件物理删除冲突记录和大 ID 文章

- **严重度**：P1/P2
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/provider/article/article.provider.ts:1731-1903`
  - `packages/server/src/provider/article/article.provider.ts:1972-2021`
  - `packages/admin/src/pages/DataManage/tabs/ArticleManager.jsx:51-89`
  - `packages/admin/src/pages/DataManage/tabs/ArticleManager.jsx:166-213`
- **触发条件**：
  1. 重排目标 ID 与未进入本次 `articles` 集合的记录冲突；或
  2. 执行“清理临时 ID”，且库中存在任意 `id >= 50000` 的文章。
- **实际行为**：
  - `reorderArticleIds()` 先把范围外冲突文章移动到 `50000+`，重排结束后再直接 `deleteOne()` 物理删除这些文章。
  - `cleanupTempIds()` 把全部 `id >= 50000` 都视为临时记录并逐篇物理删除，没有来源标记、白名单或可恢复快照。
- **影响**：合法大 ID 文章、历史遗留记录、软删除记录或上次中断后留下的数据都可能被永久删除；管理端警告无法替代后端的数据保护。
- **最小复现**：
  - 参与重排文章 `id=99`，范围外冲突文章 `id=1`；实际执行 `1 -> 50000`，随后删除 `id=50000`。
  - 给 `cleanupTempIds()` 返回 `50000` 和 `50001` 两篇记录，两篇均被删除。
- **附带风险**：整个重排跨多次独立写入且没有事务；中途失败会留下临时 ID、已改正文链接或部分完成的映射。
- **建议修复方向**：禁止删除未明确属于本次操作的记录；为临时记录写入唯一 operation ID 并仅清理该批次；重排前生成完整映射和快照，在单事务或可恢复迁移中执行。后端应要求二次确认令牌并提供 dry-run。

### L-006：非空站点的备份恢复失败后无法回滚

- **严重度**：P1
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/controller/admin/backup/backup.controller.ts:714-1042`
  - `packages/server/src/controller/admin/backup/backup.controller.ts:1645-1657`
  - `packages/server/src/controller/admin/backup/backup.controller.ts:1697-1733`
  - `packages/server/src/storage/structured-data.service.ts:2145-2172`
- **触发条件**：在已有内容的站点导入整站备份，并在清理完成后的任一导入阶段发生异常。
- **实际行为**：
  1. 先删除 folder 型自定义页面及静态文件；
  2. 并行清空 record-store 中的大量集合；
  3. 逐表清空 PostgreSQL 结构化数据；
  4. 再按用户、Meta、设置、文章等阶段导入备份。

  该流程没有导入前快照、跨存储事务或失败补偿。
- **影响**：导入失败虽然会将任务标为失败，但原站点已经被破坏，只能留下部分恢复的数据；若被删除的本地文件未包含在备份中，甚至无法依靠同一备份恢复。
- **建议修复方向**：恢复前自动创建可校验的完整快照；优先导入到 staging 表/目录并校验后原子切换；不能原子切换的资源应记录补偿日志并自动回滚。UI 应明确区分“验证备份”和“提交恢复”。

### L-007：结构化数据同步异常被吞掉，备份导入仍报告成功

- **严重度**：P1/P2
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/controller/admin/backup/backup.controller.ts:113-126`
  - `packages/server/src/controller/admin/backup/backup.controller.ts:997-1002`
  - `packages/server/src/controller/admin/backup/backup.controller.ts:1021-1039`
- **触发条件**：备份内容已写入 record-store，但 `refreshCollectionsFromRecordStore()` 或 `refreshAllFromRecordStore()` 同步 PostgreSQL 结构化表时抛错。
- **实际行为**：`refreshStructuredData()` 只写错误日志而不重新抛出；调用方随后仍把 `structuredData` 阶段标记完成，并调用 `completeJob()` 返回 `statusCode: 200`。
- **影响**：
  - 后台显示“导入完成”，但 record-store 与结构化查询表可能不一致。
  - 生产读取大量优先走结构化表，用户可能看到缺文章、旧数据或部分恢复结果。
  - 错误状态无法触发运维重试或回滚。
- **最小复现**：让两个 refresh 方法均抛出“simulated PostgreSQL sync failure”；`executeImport()` 仍返回 200，调用 `completeStage('structuredData')` 和 `completeJob()`，未调用 `failJob()`。
- **建议修复方向**：结构化同步应作为恢复提交的强制阶段并向上抛错；若确需降级，应把任务标为“部分成功/需修复”而不是完成，并提供幂等重试入口和一致性校验报告。

### L-008：草稿转文档成功后使用原始字符串 ID 删除草稿

- **严重度**：P1/P2
- **状态**：已确认
- **模块/位置**：
  - `packages/server/src/controller/admin/draft/draft.controller.ts:256-305`
  - `packages/server/src/provider/draft/draft.provider.ts:288-297`
  - `packages/server/src/main.ts`（未启用全局参数类型转换）
- **触发条件**：通过 HTTP 调用 `POST /api/admin/draft/:id/convert-to-document`。
- **实际行为**：
  - 控制器先把路由参数规范化为数字 `draftId`，并使用它查询草稿。
  - 文档创建成功后却调用 `deleteById(id)`，传回未经规范化的原始路由参数。
  - Nest 路由参数默认是字符串；record-store 查询比较使用严格相等，字符串 `"42"` 不匹配数字 `42`。
- **影响**：接口返回成功且文档已创建，但原草稿仍存在，用户可能重复转换并产生重复文档。
- **最小复现**：以字符串 `"42"` 调用控制器；查询使用数字 `42`，删除调用收到字符串 `"42"`，数字 ID 草稿未被标记删除。
- **建议修复方向**：删除时使用已校验的 `draftId`；最好把“创建文档 + 删除草稿”封装成事务性服务，并增加真实 HTTP/e2e 测试验证转换后草稿不可见。

## 待验证候选

以下项目有风险信号，但本轮尚不足以登记为已确认缺陷。

| 编号 | 候选问题 | 主要位置 | 下一步验证 |
| --- | --- | --- | --- |
| C-001 | 初始化控制器的 `checkHasInited()` 与 `init()` 之间没有互斥；并发请求可能同时通过检查。 | `packages/server/src/controller/admin/init/init.controller.ts:53-60` | 用两个数据库连接并发提交不同管理员资料，确认唯一约束、最终状态和错误响应；评估 PostgreSQL advisory lock。 |
| C-002 | record-store 查询引擎只支持简单 `$pull`，positional `$` 也只能提取简单等值条件。 | `packages/server/src/storage/query-engine.ts:248-293,338-349` | 盘点实际调用是否会传对象条件、`$in`、`$elemMatch` 或嵌套数组，并与 Mongo 语义做差分测试。 |
| C-003 | `updateMany()` 先读全量再逐条 upsert，多个并发更新可能基于旧快照互相覆盖。 | `packages/server/src/storage/collection-model.ts:176-195` | 对相同记录并发执行不同 `$set` / `$inc`，检查最终值；评估改为 SQL 原子更新或版本号 CAS。 |
| C-004 | 根 `Dockerfile` 把未设置的 `VAN_BLOG_BUILD_SERVER` 写入 `VAN_BLOG_SERVER_URL`；空值是否覆盖网站构建的默认服务地址需做镜像构建验证。 | `Dockerfile:38-49`、`packages/website/utils/loadConfig.ts:11-23` | 不传 build arg 构建遗留单镜像，检查 Next 构建取数 URL、产物和启动行为。 |
| C-005 | `entrypoint.sh` 直接把 `${EMAIL}` 放入 `sed` replacement；包含 `&`、反斜杠或分隔符的值可能破坏输出。 | `entrypoint.sh:12` | 使用包含特殊字符的合法/边界邮箱生成 Caddyfile，并执行 `caddy validate`。 |
| C-006 | 多个 provider 先写 record-store，再单独 upsert 结构化表；第二步失败时可能产生双写不一致。 | 例如 `article.provider.ts:283-291,1657-1700`、`draft.provider.ts:86-92,288-308` | 注入结构化 upsert 故障，确认接口返回、record-store 状态、读路径和自动修复能力；制定统一事务/outbox 策略。 |
| C-007 | `getTopVisited()` 的旧 fallback 用 `viewer != 0` 过滤，却按 `visited` 排序，可能漏掉 `viewer=0、visited>0` 的文章。 | `packages/server/src/provider/article/article.provider.ts:445-466` | 确认生产是否可能在结构化服务未初始化时进入 fallback；若可进入，补字段语义测试。 |

## 已验证非问题

### N-001：协作者可上传图片属于当前权限设计

- `post-/api/admin/img/upload` 明确列在 `publicRoutes`。
- 管理端说明和 `docs/advanced/collaborator.md` 均写明协作者默认拥有文章、草稿、图片查看及图片上传能力，`img:delete` 只控制删除。
- 因此本轮不将“无 `img:delete` 权限仍可上传”登记为越权缺陷。
- **残余风险备注**：上传能力仍应有文件类型、大小、配额和频率限制，以降低存储滥用风险；这是容量治理问题，不改变当前权限结论。

### N-002：新部署拓扑的 Atom 路由已经正确

- `docker/caddy/Caddyfile`
- `docker/caddy/Caddyfile.https`
- `docker/all-in-one/Caddyfile`
- `tests/host-dev/Caddyfile`

上述配置均将 `/atom.xml` 正确改写到 `/rss/atom.xml`。L-001 只登记遗留根单镜像配置，不能扩大解释为当前 split/all-in-one 主路径故障。

## 维护约定

1. 新问题优先附最小复现或失败测试，避免仅凭代码气味登记为缺陷。
2. 修复后将状态改为“已修复”，记录提交、发布日期和回归测试，不删除历史条目。
3. 涉及数据删除、备份恢复、认证或双写一致性的条目，关闭前至少增加一个失败路径测试。
4. 基线升级后重新核对文件行号；若逻辑已迁移，保留原位置并追加新位置。
