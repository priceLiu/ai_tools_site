# 工具管理与工具打标签

## 需求背景

运营需要在后台集中维护「统计入口」与「按工具打标签」，避免侧栏直连 `/admin/stats` 与标签后台割裂；标签词表规模大时，仍需可用、可控延迟的选用体验。

## 功能说明

1. **侧栏**：「工具管理」→ `/admin/stats`（统计模块）；其下子项「工具与标签」→ `/admin/tools-tagging`。`/admin/tools-management` 仅保留并重定向到 `/admin/stats`（兼容旧链）。
2. **工具与标签页**：选定工具后编辑至多 20 个标签（沿用 `tool_tags` + `neonSetToolTagsForTool`）。
3. **打标签交互**
   - **工具**：名称/slug 模糊搜索，留空按更新时间列出少量候选（服务端 LIMIT）。
   - **普通标签**：关键词 + ILIKE，结果严格 LIMIT；可选「场景」下拉缩小候选（`tags.tag_category_id`：全部 / 未归类 / 指定 `tag_categories`）。
   - **角色辅助**：下拉选择 `role_categories`，展示 `role_category_tags` 中的标签按钮，一键并入草稿（仍写入同一 `tool_tags` 边表）。
4. **缓存**：`setToolTagsAction` 成功时补充失效首页标签聚合、`/tag`、`/tag-category`、对应 `/tool/[slug]`，与批量重写标签策略对齐。

## 实施步骤（已完成）

1. `lib/neon/data.ts`：`neonAdminSearchTagsForPicker`、`neonAdminSearchToolsForTagging`、`neonAdminGetToolTagsForEditor`、`neonSetToolTagsForTool`（可选 `tagCategoryHints`）、`neonAdminListTagsForRoleCategoryPicklist` 及类型导出。
2. `app/admin/tools-tagging/actions.ts`：管理员校验 + 封装上述 Neon 查询。
3. `components/admin-tool-tagging-panel.tsx`：客户端面板（工具 Popover、场景/角色 Select、标签 Popover、草稿 chips、`setToolTagsAction` 保存）。
4. `app/admin/tools-management/page.tsx`（重定向至 `/admin/stats`）、`app/admin/tools-tagging/page.tsx`：路由与文案。
5. `components/compact-app-sidebar.tsx`：「工具管理」→ `/admin/stats`，缩进子项「工具与标签」→ `/admin/tools-tagging`；审核列表高亮排除上述路径。
6. `app/admin/stats/page.tsx`：顶部链至「工具与标签」与「审核列表」。
7. `app/actions/tool-tags.ts`：`setToolTagsAction` 扩展 revalidate。

## 统计口径（统一）

- **收录工具数**（首页场景卡片、场景聚合页工具列表、`neonCountPublicListedToolsByTagCategoriesBulk` / `neonListToolsByTagCategoryId.length`）：`COUNT(DISTINCT tools.id)`，要求工具 `approved` 且未 `is_disabled`，且至少有一条 `tool_tags` 指向 **`tags.tag_category_id` 为该场景** 且标签未禁用。
- **词条数**：该场景下 `tags` 行数（`tag_category_id` 命中），与收录工具数不是同一指标。
- **标签管理页 Tab**：加粗为收录工具数；`· N词` 为全库词条数；末尾额外数字（若有）为当前视图（Curated/搜索）下的表内条数。

## 搜索与性能约定

- 首页「按场景」按<strong>标签行上的 `tag_category_id`</strong>聚合，场景分类名本身（如「数据与编程」）不一定对应同名标签；种子库里该场景下多为「代码生成」「代码补全」等词条。
- 管理页在左侧选定<strong>某一具体场景</strong>后保存时：草稿里 **`tag_category_id` 仍为空**的标签会自动套用该场景 id（修复历史裸露标签）。
- 历史上已写入、但 `tag_category_id` 为空的标签：可在「标签管理」为该标签指定场景，或在工具页删掉该标签后在「指定场景」筛选下重新选用同一词条保存。
- 标签与工具查询均只 SELECT 展示所需列，并对结果集硬上限（标签默认 ≤80，工具 ≤50）。
- 标签空关键词时按 `tool_tags` 引用次数近似「常用优先」，仍受 LIMIT 约束。
- 词表达到万级时，当前组合（ILIKE + LIMIT + 可选场景缩小范围）在管理后台场景可接受；若未来需要亚秒级模糊检索，可单独加 `pg_trgm` / `name`  btree 类迁移，不改变页面契约。
