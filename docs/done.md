# 已完成功能清单

> 记录已实现的功能，便于追溯和维护。

---

## 2026-05-06（深夜）

### Neon → 腾讯云 数据迁移完成（阶段 5：实测）

**进度**：阶段 5 / 7（数据迁移完成；剩 CloudBase Run 部署 + 收紧安全 + 留档）。

**实操过程关键里程碑**（仅记里程碑，调试细节看本节末「踩坑录」）：

1. **跳过 `pg_dump`/`pg_restore`，改用纯 Node 迁移**：`scripts/migrate-neon-to-tencent.mjs`
   - 不依赖 `libpq` / Docker / 系统包；只用项目已有的 `postgres` npm 包
   - 自动按 `information_schema.referential_constraints` **拓扑排序**插入顺序
   - 自引用 FK（`categories.parent_id`、`navigation_menu_items.parent_id`）**两阶段处理**（先置 NULL 整批插入，再回填 UPDATE）
   - 单批 200 行，失败自动降级到逐行重试（便于定位脏数据）
   - 全程 30 秒内完成；可重复执行（DELETE → INSERT 模式幂等）
   - `--check` 仅做连通性测试；`--skip-schema` / `--data-only` 复跑用

2. **辅助探针脚本**：
   - `scripts/probe-tencent-pg.mjs`：4 种 SSL 配置穷举
   - `scripts/probe-tencent-raw-tcp.mjs`：raw TCP 层手发 PG SSL 请求包，看返回字节

3. **腾讯云 PG 实例配置**（用户侧已完成）：
   - 上海二区主、上海三区备（高可用版，月费约 800 元；后续可在线降配为单节点 ≈400 元）
   - PG 16.10、1c2g、20GB 存储、UTF-8、VPC `aitools-vpc` / 子网 `aitools-subnet-sh`
   - 安全组 `aitools-pg-sg` 当前临时全开 `0.0.0.0/0`（debug 状态，**部署后必须收紧**）
   - 默认数据库 `postgres`；脚本里 `CREATE DATABASE aitools OWNER aitools_admin` 自动建库

4. **schema + 数据迁移结果（2026-05-06 14:31）**：

   | 表 | Neon 行数 | Tencent 行数 | 备注 |
   |---|---|---|---|
   | tools | 174 | 174 ✓ | |
   | tags | 249 | 249 ✓ | curated 217 + 历史 32 |
   | tool_tags | 898 | 898 ✓ | |
   | navigation_menu_items | 14 | 14 ✓ | 自引用 FK |
   | categories | 13 | 13 ✓ | 自引用 FK |
   | ad_placements | 12 | 12 ✓ | |
   | tag_categories | 8 | 8 ✓ | |
   | profiles | 2 | 2 ✓ | |
   | auth_credentials | 2 | 2 ✓ | |
   | app_kv | 2 | 2 ✓ | base64 logo / 图片 |
   | tool_comments | 1 | 1 ✓ | |
   | favorites | 0 | 0 ✓ | |
   | **合计** | **1375** | **1375** | **100% 一致** |

   schema 应用：27 个迁移文件全部 ✓，跳过 2 个 `storage.*`（Supabase 残留，纯 PG 不需要）；`pgcrypto` 扩展自动启用。

5. **应用代码层**：
   - `.env.local` 切到 `DATABASE_URL=Tencent (公网串)`，原 Neon 串保留为 `NEON_DATABASE_URL_BACKUP` 紧急回滚用
   - `lib/neon/sql.ts` 已在阶段 1–4 改成纯 `postgres` TCP，无需再改

**踩坑录（按发生顺序）**：

| 序号 | 现象 | 原因 | 解决 |
|---|---|---|---|
| ① | `pnpm install --no-frozen-lockfile` 卡死交互 | pnpm 卡在「是否清空 node_modules」 | `--config.confirmModulesPurge=false` |
| ② | `brew install libpq` 跑 8 分钟无声 | `2>&1 \| tail` 吞掉所有输出 + 国外网络慢 | 弃用 `pg_dump`，改纯 Node |
| ③ | TencentDB 通过买 `cynosdb` 路径找不到 PG Serverless | TDSQL-C PostgreSQL **没有** Serverless 形态 | 改买「云数据库 PostgreSQL」（pgsql 路径） |
| ④ | URL 里密码含 `@` 把 host 割成 `1389@sh-postgres-...` | URL 解析器把密码里 `@` 当分隔符 | 重置成纯字母数字下划线密码 |
| ⑤ | `nc -zv` 通但 PG 协议 30 秒零返回 | SG 入站规则 `216.227.168.217/32` **不生效**（原因不明，可能是 LB 与 SG 绑定的客户端 IP 与 ifconfig.me 不一致） | 临时改 `0.0.0.0/0` 跑通；部署后改走 VPC 内网 |
| ⑥ | `ssl: 'require'` 连不上 | 腾讯云 PG 实例**默认未开 SSL** | URL 改 `?sslmode=disable`、`postgres({ssl: false})` |
| ⑦ | `database "aitools" does not exist` | 创实例只默认建 `postgres` 库 | 脚本先连 `postgres` 库 `CREATE DATABASE aitools` |
| ⑧ | CloudBase Run 首次构建挂在 `Error: DATABASE_URL is required` at `neonListTagCategoriesAll`（`Export encountered an error on /role/office-worker`）| `app/role/[slug]/page.tsx` 早期是 `dynamicParams = false`，强制 build 时把 9 个角色 slug 全预渲染；但 Docker 构建阶段拿不到运行时环境变量，DB 调用直接报错 | 改 `dynamicParams = true` + 给 `generateStaticParams()` 加 `if (!process.env.DATABASE_URL) return []` 哨兵：build 期不预渲染任何角色页，运行时首次访问 SSR + 60s ISR；与其他 4 个动态页（`tag` / `tag-category` / `category` / `tool`）的 try/catch 兜底等价，行为对用户透明 |
| ⑨ | CloudBase Run 部署后 `/tool/<slug>` 100% 500（首页与 `/api/diag` 都正常），容器日志 `digest: 'DYNAMIC_SERVER_USAGE'` | `app/tool/[slug]/page.tsx` 是 ISR（`revalidate=60` + `dynamicParams=true`），但又在 server-side `await searchParams` 读 `admin_preview`。Next 16 在首次访问未预渲染 slug 时执行 demand-static，遇到 per-request 动态 API 直接抛 `DYNAMIC_SERVER_USAGE`。Vercel 部署「Ready」后没人真访问过这页，所以问题潜伏到 CloudBase Run | 把 `admin_preview` 从 server-side 移到 `<ToolDetailPublicView>`（`'use client'`）里用 `useSearchParams()` 读；`page.tsx` 完全不再访问 `searchParams`；用 `<Suspense>` 包客户端组件防 Next 把整页 deopt 成 dynamic。保留 60s ISR 不变 |
| ⑩ | `/submit` 编辑页报「Server Components render error」，容器 CLS 日志：`code:'23502' table_name:'tools' column_name:'view_count' detail:'Failing row contains (..., tt1, ...)'` | `app/actions/database-mutations.ts` 调 `neonSubmitInsertTool` 没传 `view_count`，`lib/neon/data.ts` 的 INSERT 用三元表达式把 undefined 翻译成 `null`。Neon 上 `tools.view_count` 列被 Supabase 早期某次 ALTER 改成 nullable=YES（schema 漂移），所以 NULL 也能插；腾讯 PG 严格遵守 migration 文件里 `NOT NULL DEFAULT 0` → 23502 | 1) 把 INSERT 里 `v.view_count != null ? Number(v.view_count) : null` 改成 `... : 0`，不依赖 schema 漂移；2) 新增 `scripts/diff-schema-neon-vs-tencent.mjs`：列/trigger/function/sequence/extension 多维对账，迁移完成后跑一遍能立刻看到漂移 |

**当前已知风险（部署前必处理）**：

- ⚠️ SG 仍是 `0.0.0.0/0`（debug 残留）→ 部署后改走 VPC 内网，SG 直接删那条
- ⚠️ 密码 `Password_1` 偏弱 → 部署后改强密码（用 `openssl rand -base64 24`）
- ⚠️ SSL 关闭 → 公网串带 `sslmode=disable`；走 VPC 内网后无所谓

---

## 2026-05-06（晚）

### Neon → 腾讯云 整站迁移（启动 / 阶段 1–4 完成）

**需求背景**：国内移动网络访问 `*.vercel.app` 不稳；同时 Neon 跨境到 Vercel 即使同区也有 30ms 网络往返。把整站搬到腾讯云广州 / 上海，DB 与应用同 VPC 内网，配合 ICP 备案彻底解决访问稳定性。

**最终路线**：
- 数据库：Neon PG → **腾讯云 云数据库 PostgreSQL 16**（TencentDB for PostgreSQL，原生 PG，与现有 100 处 SQL 模板 0 冲突）
- 应用：Vercel → **CloudBase Run（容器托管）**，与 DB 同地域 VPC
- **不做**的事：不切 CloudBase 文档型 / MySQL（避免 1.5–3 周重写）；不动 100 处 SQL；不改 schema；不改鉴权 / 图片 / 业务

> 中途修正：原计划写「TDSQL-C PostgreSQL Serverless」**实际不存在**（腾讯云 Serverless PG 只有 MySQL 版）。改为「云数据库 PostgreSQL」（标准托管 PG 16，单机版起步约 ¥85/月），与 Neon 行为最接近、价格也最低。

**本次实现内容（机器侧 4 步，无需腾讯账号）**：

1. **迁移手册 + 进度看板**：`docs/migration-tencent.md`
   - 12 步勾选式进度看板
   - 用户侧（开账号 / 买实例 / 备案）+ 机器侧（dump / restore / 部署）+ 验收 + 回滚 + 问题速查
   - 目标架构 mermaid 图

2. **数据迁移脚本**（无 `psql` 也能跑就提示，需要时 `brew install libpq`）：
   - `scripts/dump-from-neon.sh`：`pg_dump` 自定义格式 + 纯 SQL 双备份 + 表行数 / 函数 / 扩展 / RLS 策略统计
   - `scripts/restore-to-tencent.sh`：先 `CREATE EXTENSION pgcrypto`、跑 `anon` / `authenticated` 角色与 `auth.uid()` 桩、再 `pg_restore --jobs=4`、最后 `ANALYZE` + 健康检查
   - `dumps/` 目录已加入 `.gitignore`

3. **最小代码改造**（保留 `lib/neon/` 路径不动，60+ 文件 import 不受影响）：
   - `lib/neon/sql.ts`：移除 `@neondatabase/serverless` HTTP 驱动分支与 `usePostgresTcp` / `isNextEdgeRuntime` 路由，永远走 `postgres` TCP；错误文案 `Neon` → `数据库`
   - `package.json`：删 `@neondatabase/serverless`；保留 `postgres@3.4.5`；`pnpm-lock.yaml` 同步
   - `next.config.mjs`：加 `output: 'standalone'`
   - 新增 `Dockerfile`：3 阶段（deps / build / runtime），node:22-alpine + alpine 装 argon2 编译依赖 + 非 root 用户运行
   - 新增 `.dockerignore`：排除 `node_modules` / `.next/cache` / `.env*` / `docs` / `supabase` / `dumps` / `scripts` / `.vercel`
   - 更新 `database.env.sample`：移除废弃的 `NEON_DRIVER`、补 Tencent DB URL 格式

4. **验证**：
   - `npx tsc --noEmit` 通过
   - `pnpm run build` 通过；`.next/standalone/server.js`（6.8 KB）+ `.next/static`（74 MB）正常产出
   - `Grep '@neondatabase/serverless'` 仅剩注释里的历史背景说明

**下一步（暂停等用户）**：用户按 `docs/migration-tencent.md` 第三节走 6 步开通腾讯云资源（账号 / CloudBase 环境 / TDSQL-C PG / CloudBase Run）；拿到 Tencent DB 公网串后我跑 dump → restore → CloudBase Run 部署 → 验收切流。

---

## 2026-05-05

### 首页广告位系统

**需求背景**：在首页 logo 下方增加两块广告位，用于推荐工具展示。

**实现内容**：

1. **Section 1（三标签滚动区）**
   - 左侧三个可切换标签（A/B/C，名称可后台配置）
   - 右侧显示对应标签的工具列表，最多 20 个
   - 两行布局，横向滚动
   - 工具 logo 尺寸与普通工具卡片一致
   - 右侧滚动视口高度用容器宽度（cqw）按 16:9 与栅格列数推算约一行半，避免底部大块留白

2. **Section 2（轮播横幅区）**
   - 每屏显示 3 个带 banner 图的工具
   - 自动轮播（默认 10 秒，后台可配置）
   - 鼠标悬停暂停，离开继续
   - 共 9 个位置，3 屏轮播

3. **管理后台**
   - `/admin/ads` 广告位管理页
   - 支持新建、编辑、下线、删除广告投放
   - 有效期设置（开始/结束时间）
   - Section 2 需上传 banner 图
   - 价格设置（展示用，支付功能待接入）
   - 全局开关（整体启用/禁用广告）
   - 轮播时间配置
   - 标签名称配置
   - 排序功能（上下箭头调整顺序）

4. **数据库**
   - `ad_placements` 表：存储广告投放配置
   - `app_kv` 表中 `ad:settings` 键：存储全局设置

5. **技术特性**
   - 支持 ISR 静态化（后台"生成静态"按钮会刷新广告缓存）
   - 图片代理 `/api/img/ad/[id]` 处理 banner 图
   - 工具 logo：`data:` 内联仍走 `/api/img/tool/<id>/logo`，`http(s)` 原样直链，无 logo 时不下发占位代理 URL（避免无谓 404 与服务端查询）
   - **首页快照与缓存**：bundle 写入 `app_kv` 后轮询读；失效 Data Cache / ISR 时必须**先重建快照再 `revalidateTag`**，审核通过等后台写操作会通过 `revalidateHomeToolBundleAction` 同步执行，避免出现「刷新了首页却仍读旧快照」；同一 action 会一并 `revalidateTag(home-ads)`，广告位与工具上线/编辑保持同步
   - 响应式设计：PC 端按设计显示，移动端自适应

---

### 评论管理（管理后台）

**需求背景**：工具详情评论需要检索、隐藏不当内容；需要汇总统计；需要对违规用户禁言（仅禁止评论，不等同于禁用账号）。

**实现内容**：

1. **数据库**（`20260505140000_comments_moderation_and_mute.sql`）
   - `tool_comments`：`user_id`（关联发表者）、`is_hidden`（前台隐藏）
   - `profiles`：`comment_muted`、`comment_mute_reason`

2. **`/admin/comments`**
   - 统计卡片：总评论、可见、已隐藏、禁言用户数、有评论的工具数
   - 各分类**可见**评论数柱状图（ECharts）
   - 各工具评论数表格（可见/隐藏/合计，前 80 名）
   - 评论列表：关键词搜索（正文/昵称/邮箱）、状态筛选、分页；隐藏 / 恢复
   - 禁言：按邮箱/昵称搜索用户；当前禁言用户列表；禁言/解除（可选原因）

3. **前台**
   - 发表评论写入 `user_id`；禁言用户提交时返回明确错误提示
   - 列表仅展示未隐藏评论


## 2026-05-06

### 标签管理系统改造（按场景找 AI）

**需求背景**：左侧分类菜单覆盖度有限，用户难以快速找到「打工人 / 创业老板 / 自媒体 / 学习者」相关工具；同时需要把官方 217 个细分标签接进来，做一次「场景 → 标签 → 工具」的整体梳理与清洗。

**实现内容**：

1. **数据库**（迁移文件）
   - `20260506000000_tag_categories_and_curated_tags.sql`：新增 `tag_categories`；`tags` 加列 `tag_category_id` / `is_curated` / `aliases`；`tool_tags.sort_order` 上限 0..5 → 0..19；`set_tool_tags_for_tool` 函数 `EXIT WHEN i >= 20`
   - `20260506000100_seed_tag_categories_and_curated_tags.sql`：写入 8 个 `tag_categories`（按 `docs/type.txt` 顺序）+ 217 个 curated tags；`ON CONFLICT (slug)` / `ON CONFLICT (lower(trim(name)))` 幂等可重跑

2. **关键词词典 + 自动打标**
   - `lib/tag-keywords.ts`：217 标签 → 同义关键词数组（中文 + 英文 + 口语词，每标签 5–10 条）
   - `lib/tool-tags-extract.ts` 重写：标题（5）/ 描述（3）/ 介绍（1）三段加权评分；建议输出默认 ≤ 12，硬上限 20；首位仍兜底分类名（属 217 词表则规整）
   - `app/actions/tool-tags.ts`：`bulkExtractToolTagsAdminAction` 改为只跑 `status='approved' AND NOT is_disabled` 的工具，并在跑完后失效首页 / 分类详情 / `/tag-category/*` / `/tag/*` / `/role/*` ISR

3. **管理后台 `/admin/tags`**
   - 数据层：`neonAdminListTagsAll` / `neonAdminListUncuratedTags` / `neonAdminMergeTags` / `neonAdminRenameTag` / `neonAdminDeleteTag` / `neonAdminSetTagCurated`
   - Server Action：`adminMergeTagsAction` / `adminRenameTagAction` / `adminDeleteTagAction` / `adminSetTagCuratedAction`
   - UI（`components/admin-tags-manager.tsx`）：统计、视图切换（Curated / 待清理 / 全部）、分类筛选、搜索；行操作支持改一级分类、改 curated、改名、合并到目标、删除（工具数为 0 时）
   - 侧栏入口：管理后台「标签管理」（`Tag` icon）

4. **公开页**
   - `/tag-category/[slug]`：8 个一级分类详情（chip + 工具网格 + `CollectionPage` / `ItemList` JSON-LD）
   - `/tag/[slug]`：单个标签详情（`generateStaticParams` 仅预生 curated）
   - `/role/[slug]`：4 个角色聚合页（打工人 / 创业老板 / 自由职业自媒体 / 转型学习者）；配置在 `lib/tag-roles.ts`
   - `lib/tag-slug.ts`：`tagPublicPath` / `tagCategoryPublicPath` / `rolePublicPath` / `decodeTagNameFromSlug`
   - `app/sitemap.ts`：收录全部 `/tag-category/*`、curated `/tag/*`（`tool_count > 0`）、4 个 `/role/*`

5. **首页腰部「按场景找 AI」**
   - `components/home-tag-categories.tsx`：8 卡片，每张含场景图标 + 工具数 + 工具数前 5 的标签 chip；点击卡片跳 `/tag-category/<slug>`，点击 chip 跳 `/tag/<name>`
   - 数据：`lib/cached-home-tag-categories.ts`（`unstable_cache` + `HOME_TAG_CATEGORIES_CACHE_TAG`）
   - `app/page.tsx` 在广告 Section 1/2 与「最新收录」之间插入；锚点 `home-scenes`

6. **缓存失效串通**
   - 新增 `HOME_TAG_CATEGORIES_CACHE_TAG`
   - 后台所有标签写操作 + 批量重打 + `regeneratePublicStaticAction` + `revalidateHomeToolBundleAction` 都同步失效该 tag

7. **部署 / 运维工具**
   - 新增 `scripts/apply-neon-migration.mjs`：基于项目里 `postgres` 包的迁移执行器，无需 `psql`，从 `.env.local` 读 `DATABASE_URL`
   - `20260506000000_*.sql` 文件头自包含 `CREATE ROLE IF NOT EXISTS`（覆盖纯 Neon 库无 `anon`/`authenticated` 的情况）

8. **首页区块视觉与角色入口**（同日微调）
   - 8 张场景卡改为**单行高度**（icon + 名/工具数 左对齐、chip 移到右侧竖排 2 条），高度从 ~94px 降到 ~58px，所有卡片高度一致
   - 移动端（2 列）隐藏 chip 防止挤爆，桌面（4 列）保留 chip
   - 「按场景找 AI」标题行右侧新增 4 个**角色 chip**（`/role/office-worker` 等），首页正式打通角色页入口

9. **首页 hero 改版 + 公开页返回入口 + 视觉一致性**（同日二次微调）
   - 首页 hero 替换为「智选 AI」品牌 logo（`public/logo-zhixuanai.png`），移除原 Sparkles 圆角图标 + `AI工具集` h1 + 副标题；保留 `<h1 sr-only>` 兜底 SEO
   - `/role/[slug]`、`/tag-category/[slug]`、`/tag/[slug]` 三个公开页顶部加「← 返回首页」入口（与 `/tool/[slug]` 一致）
   - 修复**场景卡片不可点击**的 bug：内层 `relative z-10` 阻塞了 absolute Link 的点击事件 → 改为 `pointer-events-none` 内层 + `pointer-events-auto` chip 层，整卡可点 + chip 仍能独立跳转
   - 0 工具的场景一级分类卡片置灰：虚线边框 + `opacity-60` + `cursor-not-allowed` + 文案改「暂无工具」+ 不渲染 Link
   - 视觉一致性：角色 chip 描边 `border-primary/30 → /60`；搜索框描边加 `border-primary/60 + focus-visible:border-primary`

**进度看板 + `/admin/tags` 操作手册 + 部署指引**：见 [`docs/label.md`](label.md) 八、九、十节。


### 用户管理优化

1. **个人中心 - 修改密码**
   - 用户可在个人中心修改密码
   - 需输入当前密码验证

2. **管理后台 - 用户管理**
   - 禁用用户时需输入原因
   - 移除"删除用户"功能，仅保留禁用
   - 显示用户注册邮箱

---

### SEO 优化

1. **Sitemap 自动生成**
   - `/sitemap.xml` 动态生成
   - 包含首页、工具详情页、分类页

2. **Robots.txt**
   - `/robots.txt` 配置爬虫规则
   - 指向 sitemap 位置

3. **元数据优化**
   - 每个页面配置独立 title、description
   - Open Graph 标签支持社交分享
   - JSON-LD 结构化数据

4. **Canonical URLs**
   - 避免重复内容问题

5. **非公开页面 noindex**
   - 管理后台、个人中心等页面不被索引

---

### 静态化与性能

1. **ISR 增量静态再生成**
   - 首页、工具详情页支持静态化
   - 后台"生成静态"按钮主动触发

2. **导航菜单缓存**
   - 分类和标签数据缓存
   - 减少重复数据库查询

3. **图片代理优化**
   - `/api/img/tool/[id]/[kind]` 统一处理工具图片
   - 支持 data: URL 和外链图片

### Logo 显示与悬浮提示优化

1. **图片加载检测**
   - 图片代理返回 1x1 透明 PNG 作为 404，浏览器不触发 `onError`
   - 增加 `naturalWidth > 1` 检测，识别无效图片
   - 显示备用图标（Sparkles/ImageIcon）作为 fallback

2. **悬浮工具提示**
   - 首页 Section 1 鼠标悬浮显示工具简介
   - 使用 Tooltip 组件，延迟 200ms 显示

---

## 数据库迁移

- `20260505020000_ad_placements.sql` - 广告位表
- `20260505030000_ad_placements_tab_c.sql` - 支持第三个标签

---

## 文档

- `docs/seo.md` - SEO 实施方案
- `docs/neon-schema.md` - 数据库部署指南
- `docs/done.md` - 本文档
