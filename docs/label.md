# 标签管理系统改造（label / tag-category / role）

> 本文档是本次改动的 **Spec + 进度看板**。每完成一个阶段就把对应 `- [ ]` 改成 `- [x]` 并补一句结论。
> 配套计划：`/Users/vic.liu/.cursor/plans/tags-import-and-scenarios_*.plan.md`。

---

## 一、目标

1. 引入 **「场景一级分类（8 类）→ 标签（217+ 自动）→ 工具」** 三层模型，与现有 `categories`（左栏菜单）解耦。
2. **导入** `docs/label.txt` 217 个官方标签 + `docs/type.txt` 一级分类映射。
3. **关键词词典**自动给已审核工具打标，单工具上限放到 **20**。
4. 后台提供**标签清洗**工具：合并/改名/删除/标 curated。
5. 首页腰部加 **「按场景找 AI」8 卡片** 区块（候选 A）。
6. 公开页：`/tag-category/[slug]`、`/tag/[slug]`、`/role/[slug]`，并接入 sitemap、JSON-LD。

## 二、最终决策

| 决策 | 结果 |
|---|---|
| 角色 vs 场景 | **并存**：场景是数据层，角色是配置层（预设过滤包） |
| 一级分类用什么表 | **新建 `tag_categories`**，与 `categories` 解耦 |
| 单工具标签上限 | **20**（旧 6） |
| 自动打标方式 | **关键词词典 + 评分**，替换原 `AI_CAPABILITY_TAG_RULES` |
| 清洗策略 | 官方词表 `is_curated = true` 受保护；非官方支持合并/改名/删除 |
| 首页布局 | 候选 A：腰部 8 卡片区 |

**产品线（左侧菜单 `categories`）与标签**：详见 [`docs/tag-taxonomy-admin-alignment.md`](./tag-taxonomy-admin-alignment.md)。摘要：`categories.is_disabled`、`tags.is_disabled`、`category_tags`（菜单↔标签联结）与 `tools.category_id` 正交；`/category` 列表逻辑仍以 `category_id` 为准。

## 三、数据模型

```sql
-- tag_categories（新表）
id, name UNIQUE, slug UNIQUE, icon, sort_order, description, created_at

-- tags（加列）
+ tag_category_id  uuid REFERENCES tag_categories(id) ON DELETE SET NULL
+ is_curated       boolean DEFAULT false
+ aliases          text[]  DEFAULT '{}'

-- tool_tags（放宽）
sort_order CHECK (0..19)   -- 旧 0..5

-- 函数
set_tool_tags_for_tool(uuid, text[])  -- EXIT WHEN i >= 20
```

## 四、URL 与缓存

| 路径 | 内容 | revalidate |
|---|---|---|
| `/tag-category/[slug]` | 一级分类详情：标签列表 + 工具网格 | 60s ISR |
| `/tag/[slug]` | 单个标签详情：工具网格 | 60s ISR |
| `/role/[slug]` | 角色预设（4 张配置式聚合页） | 60s ISR |
| 写后失效 | `revalidatePath('/tag-category/[slug]', 'page')`、`'/tag/[slug]'`、首页 |  |

## 五、四个角色（配置层）

来自 `docs/slogan.seo.md`：

1. **打工人**（`office-worker`）：办公与效率提升 + 数据/编程的 SQL/Excel/数据可视化 + 生活/创意的简历/面试
2. **创业老板·一人公司**（`founder`）：营销与商业 + 部分内容创作 + 部分办公提效
3. **自由职业·自媒体**（`creator`）：内容创作与自媒体 + 设计创意
4. **转型学习者**（`learner`）：学术与教育 + 数据/编程的代码教学

具体绑定的标签集见 `lib/tag-roles.ts`。

## 六、实施进度（勾选式）

### Phase 0：Spec 文档

- [x] 写 `docs/label.md`（本文件），列出阶段清单

### Phase 1：数据库迁移

- [x] 新增 `tag_categories` 表
- [x] `tags` 加列：`tag_category_id`、`is_curated`、`aliases`
- [x] 放宽 `tool_tags.sort_order` CHECK 0..19
- [x] 改 `set_tool_tags_for_tool` 函数：`EXIT WHEN i >= 20`
- [x] 迁移文件：`supabase/migrations/20260506000000_tag_categories_and_curated_tags.sql`

### Phase 2：导入官方词表（种子）

- [x] 写入 8 个 `tag_categories`（按 type.txt 顺序，配 lucide 图标）
- [x] 写入 217 个 curated `tags`（按 type.txt 映射 `tag_category_id`，含 docs/label.txt 第 66 行「原型图」并入设计创意）
- [x] `INSERT … ON CONFLICT DO UPDATE`，幂等可重跑
- [x] 迁移文件：`supabase/migrations/20260506000100_seed_tag_categories_and_curated_tags.sql`

### Phase 3：关键词词典

- [x] 新建 `lib/tag-keywords.ts`（导出 `TAG_KEYWORDS`、`CURATED_TAG_NAMES`、`TAG_TO_CATEGORY_NAME`、`getTagKeywordSpec`、`getCategoryOfTag`、`TAG_CATEGORY_NAMES`）
- [x] 217 个标签全部覆盖；每个 5–10 个同义/英文/口语关键词
- [x] 提供 `getTagKeywordSpec(name)` 与 `getCategoryOfTag(name)`

### Phase 4：自动打标重写

- [x] 重写 `lib/tool-tags-extract.ts`：保持 `buildSuggestedToolTagNames` 签名兼容（新增可选 `name` / `description` / `limit`）
- [x] 评分：标题(5) > 描述(3) > 介绍(1)；统一 `NFKC` + 小写匹配
- [x] `TOOL_TAGS_MAX = 20`，输出建议 ≤ 12；首位仍兜底分类名，且若属 217 词表则规整为 curated 标准名
- [x] 同步：`neonSetToolTagsForTool` 上限 6→20、`bulkExtractToolTagsAdminAction` 跑完后失效首页 / 分类 / 详情 / `/tag-category` / `/tag` / `/role` ISR

### Phase 5：管理后台 `/admin/tags`与场景分类

- [x] 数据层 `lib/neon/data.ts`：`neonAdmin*` 系列、`neonListTagCategoriesAll`、`neonListTagCategoriesEnabled`、`neonGetTagCategoryBySlug`（可按 `includeDisabled`）、`neonGetTagCategoryById`、`neonAdminInsertTagCategory`、`neonAdminAssignTagToCategory`、`neonAdminSetTagCategoryDisabled`；以及 `neonGetTagByName`、`neonListToolsByTagId`、`neonListToolsByTagCategoryId`、`neonListTagsForCategoryWithCounts`
- [x] Server Action：`app/admin/tags/actions.ts`、`app/admin/tag-categories/actions.ts`
- [x] 客户端：`components/admin-tags-manager.tsx`（视图切换、搜索；按场景 **Tabs** + 表格限高；合并 / 改名 / 删 / curated）；`components/admin-scene-category-manager.tsx` / `admin-tag-stats-cards` / `admin-tag-create-card`
- [x] 页面：`app/admin/tags/page.tsx`（清洗视图）、`app/admin/tag-categories/page.tsx`（统计 + 新建标签 + 场景分类 CRUD）
- [x] 侧栏：`compact-app-sidebar.tsx`（**标签管理** 与 **场景分类管理**平级）

### Phase 6：批量重打

- [x] `bulkExtractToolTagsAdminAction` 内部默认上限 12，硬上限 20；标题/描述/介绍三段评分
- [x] `neonListToolsIdIntroFormatCategoryName` 已过滤 `status='approved' AND NOT is_disabled`
- [x] 跑完后失效首页 / 分类详情 / `/tag-category/[slug]` / `/tag/[slug]` / `/role/[slug]` ISR；同步重建 `app_kv` 首页快照与 `HOME_ADS_CACHE_TAG`
- [x] 入口：管理后台侧栏「发布与维护」→「一键提取全部标签」按钮（已存在）

### Phase 7：公开页 + SEO

- [x] `app/tag-category/[slug]/page.tsx`：metadata + canonical + `CollectionPage` + `ItemList` JSON-LD；`generateStaticParams` 预生 8 张
- [x] `app/tag/[slug]/page.tsx`：同上；`generateStaticParams` 预生 curated 标签
- [x] `app/role/[slug]/page.tsx`：4 张固定预生（`dynamicParams = false`）
- [x] `lib/tag-slug.ts`：`tagPublicPath` / `tagCategoryPublicPath` / `rolePublicPath` / `decodeTagNameFromSlug`
- [x] `lib/tag-roles.ts`：4 个角色配置（打工人 / 创业老板 / 自由职业 / 转型学习者）
- [x] `app/sitemap.ts` 收录 8 个 `/tag-category/*` + curated 标签 `/tag/*`（`tool_count > 0`）+ 4 个 `/role/*`
- [x] `app/robots.ts` 不需改

### Phase 8：首页区块（候选 A）

- [x] `components/home-tag-categories.tsx`：8 卡片，每张含工具数 + 标签 chip 前 5（移动 2 列、桌面 4 列）
- [x] 接入 `app/page.tsx`：广告 Section 1/2 与「最新工具」之间，锚点 `home-scenes`
- [x] 数据：`lib/cached-home-tag-categories.ts`（`unstable_cache` + `HOME_TAG_CATEGORIES_CACHE_TAG`）
- [x] 写后失效：`adminMergeTagsAction` / `adminRenameTagAction` / `adminDeleteTagAction` / `adminSetTagCuratedAction` / `bulkExtractToolTagsAdminAction` / `regeneratePublicStaticAction` 均带 `HOME_TAG_CATEGORIES_CACHE_TAG`
- [x] **2026-05-06 微调**：卡片改为单行高度（icon + 名称/工具数 在左、chip 移到右侧竖排 2 个，移动端 2 列时隐藏 chip）；区块标题行右侧叠加 4 个角色 chip 作为 `/role/[slug]` 入口（打工人 / 创业老板 / 自由职业 / 转型学习者）

### Phase 9：收尾

- [x] `lib/tag-roles.ts` 4 个角色配置（office-worker / founder / creator / learner）
- [x] 更新 `docs/done.md`（2026-05-06「标签管理系统改造」一节）

## 七、验收清单

- [x] 在 Neon 上跑两条迁移：`20260506000000_*.sql` 与 `20260506000100_*.sql`（已用 `scripts/apply-neon-migration.mjs` 应用）
- [x] `select count(*) from tag_categories` = **8** ✓
- [x] `select count(*) from tags where is_curated = true` = **217** ✓
- [x] 首页腰部出现 8 卡片区（点击卡跳一级分类、点击 chip 跳标签详情）
- [x] `/admin/tags` 能看到一级分类聚合 + 待清理列表 + 合并按钮
- [ ] 跑过一次「批量重打」后，至少前 20 个工具都有 ≥ 3 个标签（待运营点击侧栏「一键提取全部标签」）
- [ ] `/tag-category/办公与效率提升` 与 `/tag/PPT生成` 都能打开，且 sitemap 含两者（迁移已就绪，待重打后 chip 可见）

## 八、`/admin/tags` 使用手册

### 视图

| 视图 | 含义 | 何时用 |
|---|---|---|
| **Curated** | 受保护的官方词表（`is_curated = true`），且 **必须有场景归属**（`tag_category_id` → `tag_categories`） | 想确认某标签是否归属正确的场景分类 |
| **待清理** | 历史落库的非官方词（`is_curated = false`）；与 Tab「未分类」（无 `tag_category_id`）不是同一概念 | 日常清洗——合并到 curated 目标或先选场景再标 Curated |

### 行内操作

| 操作 | 行为 | 备注 |
|---|---|---|
| 改场景分类（下拉） | 写 `tags.tag_category_id` | **Curated 标签不可改为「未分类」**；未 curated 可选「未分类」解绑场景 |
| 标 / 取消 Curated | 写 `tags.is_curated`（常与 `tag_category_id` 一并校验） | **标 Curated 须先选场景分类**；详见 [`docs/tag-taxonomy-admin-alignment.md`](./tag-taxonomy-admin-alignment.md) §八 |
| 改名 | `UPDATE tags SET name = ?` | 撞已有标签则会被拒绝，改用「合并」 |
| **合并** | 源 `tool_tags` 全部转目标；源名写入目标 `aliases`；删除源 | **不可逆**，事务执行；适合「图像编辑 → 图片编辑」类清洗 |
| 删除 | `DELETE FROM tags ...` | 只在 `tool_count = 0` 时允许 |

### 推荐清洗流程

1. 切「待清理」视图，按工具数从大到小逐个看；
2. 与 217 官方词表里能对上的旧标签 → **合并**到 curated 目标；
3. 改名能修好的（拼写、大小写）→ **改名**；
4. 工具数为 0 的孤立旧标签 → **删除**；
5. 最终切回「Curated」视图，检查 8 个一级分类下的覆盖；
6. 点侧栏「**一键提取全部标签**」按新词典 + 三段评分（标题 5 / 描述 3 / 介绍 1）重打，刷新 ISR。

### 写后失效

任何写操作（合并 / 改名 / 删除 / 标 curated / 改一级分类）会自动失效：

- `revalidateTag(home-tool-bundle)`、`revalidateTag(home-ads)`、`revalidateTag(home-tag-categories)`
- `revalidatePath('/')`、`'/admin/tags'`
- `revalidatePath('/tag-category/[slug]', 'page')`
- `revalidatePath('/tag/[slug]', 'page')`
- `revalidatePath('/role/[slug]', 'page')`

## 九、部署 / 数据库迁移指引

### 文件清单

```
supabase/migrations/20260506000000_tag_categories_and_curated_tags.sql   # schema
supabase/migrations/20260506000100_seed_tag_categories_and_curated_tags.sql  # 种子
```

`20260506000000_*.sql` 头部内置了 `anon` / `authenticated` 角色的 `IF NOT EXISTS CREATE`，对 Supabase 与纯 Neon 都安全（与 `20260101000001_neon_compat_roles.sql` 等价）。

### 应用迁移（任选其一）

#### 方式 A：项目内提供的 Node 执行器（推荐，无需 psql）

```bash
node scripts/apply-neon-migration.mjs \
  supabase/migrations/20260506000000_tag_categories_and_curated_tags.sql \
  supabase/migrations/20260506000100_seed_tag_categories_and_curated_tags.sql
```

- 自动从 `.env.local` 读取 `DATABASE_URL`，依赖项目里已有的 `postgres` 包；
- 多文件按顺序执行，单个文件失败仍会继续后续文件并以非 0 退出。

#### 方式 B：`psql`（需本机 `brew install libpq` 等）

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260506000000_tag_categories_and_curated_tags.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260506000100_seed_tag_categories_and_curated_tags.sql
```

#### 方式 C：原有全量脚本

```bash
DATABASE_URL=... ./scripts/apply-neon-migrations.sh
```

### 部署后必做（一次性）

1. 应用上述两条迁移；
2. 进入 `/admin/tags` → 「待清理」视图，把高工具数的旧标签合并到 curated；
3. 侧栏「**发布与维护**」 → 点「**一键提取全部标签**」（运行 `bulkExtractToolTagsAdminAction`），让所有 `status='approved' AND NOT is_disabled` 的工具按新词典重打；
4. 跑完后 ISR 已自动失效；如需立即重生成静态可再点「**生成静态**」。

### 回滚

迁移本身只**新增**结构（`tag_categories` 表 / `tags` 加列 / 放宽 `tool_tags` CHECK 上限），不破坏旧数据。若需要彻底回滚：

```sql
ALTER TABLE public.tool_tags DROP CONSTRAINT IF EXISTS tool_tags_sort_order_range;
ALTER TABLE public.tool_tags ADD CONSTRAINT tool_tags_sort_order_range
  CHECK (sort_order >= 0 AND sort_order <= 5);
ALTER TABLE public.tags DROP COLUMN IF EXISTS aliases;
ALTER TABLE public.tags DROP COLUMN IF EXISTS is_curated;
ALTER TABLE public.tags DROP COLUMN IF EXISTS tag_category_id;
DROP TABLE IF EXISTS public.tag_categories;
```

> 注意：回滚前需保证现有工具最多挂 6 个标签，否则 CHECK 会失败。可先 `DELETE FROM tool_tags WHERE sort_order > 5`。

## 十、对其它功能的影响评估

| 模块 | 影响 | 说明 |
|---|---|---|
| **移动端** | 无负面影响 | 8 卡片区是 `grid-cols-2 md:grid-cols-4`（移动 2 列 4 行 / 桌面 4 列 2 行）；新公开页复用现有 `Sidebar`（移动抽屉） + `HeaderUser` |
| **广告位** | 无功能改动 | 仅在 `revalidateHomeToolBundleAction` / `regeneratePublicStaticAction` 等失效路径上**附带**带上 `HOME_TAG_CATEGORIES_CACHE_TAG`，广告位本身渲染、数据、CRUD 全部未变 |
| **首页 / 静态页** | ISR 路径增加 4 类 | 新增 `/tag-category/[slug]` / `/tag/[slug]` / `/role/[slug]` 三类页面与首页腰部新区块；统一 60s ISR + 写后 `revalidatePath`；首页 `getHomeTagCategoryCards()` 用 `unstable_cache(60s)` |
| **sitemap** | 新增 8 + curated 标签 + 4 角色条目 | 三个新条目段都独立 try/catch，迁移未就绪时不影响主体 sitemap 生成 |
| **现有「一键提取标签」** | 行为强化 | 现在只跑 `status='approved' AND NOT is_disabled` 的工具，且会失效新增的三类公开页 ISR + 首页 8 卡片缓存 |
| **数据安全** | 不破坏旧数据 | 迁移纯新增；旧 `tool_tags` 关联完整保留；同名旧标签被原地"升级"为 curated；近义词旧标签保留为 `is_curated=false` 等待后台手动合并 |

