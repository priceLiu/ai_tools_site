# 已完成功能清单

> 记录已实现的功能，便于追溯和维护。

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
