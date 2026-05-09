# 管理后台：批量导入工具

面向运营/管理员的 **`/admin/import-tools`** 说明：数据格式、页面步骤与服务端行为。

## 入口与权限

- **路由**：`/admin/import-tools`（侧栏「批量导入」）。
- **权限**：页面需管理员登录；[`batchSuggestTagsForImportAction`](../app/admin/tools/import-actions.ts) 与 [`importDocsToolsItemsAction`](../app/admin/tools/import-actions.ts) 内再次校验 `neonGetProfileIsAdmin`。

## JSON 结构（与 `docs/data.json` 一致）

根节点为 **数组**；每条为对象，字段校验见 [`lib/parse-docs-tools-json.ts`](../lib/parse-docs-tools-json.ts)：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 工具名称 |
| `introduction` | 是 | Markdown 简介 |
| `official_url` | 是 | 官网 URL（须可被 `URL` 解析） |
| `logo_url` | 否 | 外链或 `data:image/...`；服务端会尽量拉取并转为 base64 data URL 存入 |

先点击 **「校验 JSON 结构」**：语法错误或字段不符会提示；通过后显示条目总数，后续预览/导入均基于这份校验结果。修改文本框内容会清空校验与进度状态。

## 页面操作流程

1. **选择 JSON 文件** 或粘贴内容（读取文件时有进度条）。
2. **校验 JSON 结构**（必做）。
3. **首页左侧菜单分类（可选）**：与工具提交页同源，仅来自侧栏「菜单管理」树（[`buildSubmitNavigationTier1List`](../lib/submit-category-choices.ts)）；不含仅在 `categories` 表存在、未出现在菜单中的分类。若不选此项，`tools.category_id` 可为 **NULL**；此时须至少选择下方「场景分类」或「角色分类」之一。**若要导入到新建产品线分类**，请先在「菜单管理」为该 slug 建入口并保存（会自动尝试同步分类表），或使用菜单同步按钮对齐后再选。
4. **场景分类（可选）**、**角色分类（可选）**：下拉分别来自 `tag_categories`、`role_categories`（前台启用项）。名称仅作为 [`buildSuggestedToolTagNames`](../lib/tool-tags-extract.ts) 的 **标签匹配提示**（顺序：菜单→场景→角色；会去重），**不会**自动把该场景或角色下的全部标签写入工具。
5. **校验**：上述三项须 **至少选其一**，方可预览标签匹配或导入。
6. **导入后状态**：已通过 / 审核中（与单条提交语义一致）。
7. **自动匹配标签**（默认开启）  
   - 开启：须先点 **「预览标签匹配」**。前台按批请求服务端计算每条的建议标签（与单条导入时的词典逻辑一致），展示 **进度条**、当前工具名及滚动日志（`[序号/总数] 名称 → 标签…`）。全部预览完成后才可 **「开始导入」**。  
   - 关闭：不做预览；导入时每条在服务端即时计算标签（无匹配进度 UI）。
8. **开始导入**：按较小批量写入数据库（减轻单次请求压力与图标下载耗时），展示导入进度、当前名称、逐条结果行及底部摘要。

客户端分批常量（可调）：[`components/admin-import-tools-form.tsx`](../components/admin-import-tools-form.tsx) 内 **标签预览每批 12 条**、`IMPORT_BATCH_SIZE` **导入每批 3 条**。

## 服务端行为摘要

- **`batchSuggestTagsForImportAction`**：入参为一段 `items[]`、`baseIndex`，以及可选 **`categoryId`**（菜单叶子）、**`sceneCategoryId`**（`tag_categories.id`）、**`roleCategoryId`**（`role_categories.id`）；**三者至少传其一**（空串等同省略）。服务端校验 ID 存在后，用 [`buildSuggestedToolTagNames`](../lib/tool-tags-extract.ts)（菜单名→场景名→角色名为提示前缀）生成预览标签列表。
- **`importDocsToolsItemsAction`**：解析 `items`，逐条 [`importOneTool`](../app/admin/tools/import-actions.ts)；同样接受上述三个可选 ID，规则一致。  
  - 若传入 **`tagByRelativeIndex`**（键为当前片段内下标 `"0"…`），对应行使用 **预计算标签**（含空数组），**不再**调用 `buildSuggestedToolTagNames`。  
  - **`deferBundleRevalidate`**：中间批次可为 `true`，跳过首页 bundle 等较重 revalidate；最后一批为 `false` 时再统一刷新。每批仍会 `revalidatePath('/admin')`。

**菜单分类下拉**：仅包含菜单树中出现的 **`/category/{slug}`** 叶子（[`navigation_menu_items`](../supabase/migrations/20260502153000_navigation_menu_items.sql) + [`buildSubmitNavigationTier1List`](../lib/submit-category-choices.ts)）。仅在「菜单分类管理」新建、尚未在菜单挂载的分类 **不会** 出现在本页菜单下拉中；可先仅用场景/角色完成导入与标签提示，或完善菜单后再选此项。

去重、slug、`introduction` 长度上限等与单条导入逻辑共用同一套约束（见 `import-actions.ts` / `tool-dedup`）。

## 相关文件

| 用途 | 路径 |
|------|------|
| 页面 | [`app/admin/import-tools/page.tsx`](../app/admin/import-tools/page.tsx) |
| 表单 UI | [`components/admin-import-tools-form.tsx`](../components/admin-import-tools-form.tsx) |
| Server Actions | [`app/admin/tools/import-actions.ts`](../app/admin/tools/import-actions.ts) |
| JSON 校验 | [`lib/parse-docs-tools-json.ts`](../lib/parse-docs-tools-json.ts) |
