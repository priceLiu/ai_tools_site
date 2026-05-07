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
3. **目标分类**：与工具提交页同源，来自侧栏「菜单管理」树；须选到有效叶子分类。
4. **导入后状态**：已通过 / 审核中（与单条提交语义一致）。
5. **自动匹配标签**（默认开启）  
   - 开启：须先点 **「预览标签匹配」**。前台按批请求服务端计算每条的建议标签（与单条导入时的词典逻辑一致），展示 **进度条**、当前工具名及滚动日志（`[序号/总数] 名称 → 标签…`）。全部预览完成后才可 **「开始导入」**。  
   - 关闭：不做预览；导入时每条在服务端即时计算标签（无匹配进度 UI）。
6. **开始导入**：按较小批量写入数据库（减轻单次请求压力与图标下载耗时），展示导入进度、当前名称、逐条结果行及底部摘要。

客户端分批常量（可调）：[`components/admin-import-tools-form.tsx`](../components/admin-import-tools-form.tsx) 内 **标签预览每批 12 条**、`IMPORT_BATCH_SIZE` **导入每批 3 条**。

## 服务端行为摘要

- **`batchSuggestTagsForImportAction`**：入参为一段 `items[]`、`categoryId`、`baseIndex`（全局行号偏移）；解析后用 [`buildSuggestedToolTagNames`](../lib/tool-tags-extract.ts) 生成预览标签列表。
- **`importDocsToolsItemsAction`**：解析 `items`，逐条 [`importOneTool`](../app/admin/tools/import-actions.ts)。  
  - 若传入 **`tagByRelativeIndex`**（键为当前片段内下标 `"0"…`），对应行使用 **预计算标签**（含空数组），**不再**调用 `buildSuggestedToolTagNames`。  
  - **`deferBundleRevalidate`**：中间批次可为 `true`，跳过首页 bundle 等较重 revalidate；最后一批为 `false` 时再统一刷新。每批仍会 `revalidatePath('/admin')`。

去重、slug、`introduction` 长度上限等与单条导入逻辑共用同一套约束（见 `import-actions.ts` / `tool-dedup`）。

## 相关文件

| 用途 | 路径 |
|------|------|
| 页面 | [`app/admin/import-tools/page.tsx`](../app/admin/import-tools/page.tsx) |
| 表单 UI | [`components/admin-import-tools-form.tsx`](../components/admin-import-tools-form.tsx) |
| Server Actions | [`app/admin/tools/import-actions.ts`](../app/admin/tools/import-actions.ts) |
| JSON 校验 | [`lib/parse-docs-tools-json.ts`](../lib/parse-docs-tools-json.ts) |
