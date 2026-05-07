# 个人中心「我的关注」— 计划与进度

## 目标

- 菜单「我的关注」：`/account/follows`。
- 用户可多选订阅 **场景分类**（`tag_categories`）、**角色分类**（`role_categories`），开关式 UI，保存写入服务端。
- **单个工具关注（pinned）**：在「关注动态」上方网格展示，至多 **20** 个；宽屏 **10 列**两行铺满；hover 概述与首页 `ToolCard` tooltip 一致。与 **`favorites`（我的收藏）** 独立存储。
- **关注工具列表**：按 **场景 / 角色** Tab；仅展示只读工具卡片（与收藏一致），用户对标签/工具/分类无编辑能力。
- **已失效关注**：平台禁用（`is_disabled`）或单个工具下架/驳回；单独展示并允许**移除订阅**。物理删除分类/工具时 CASCADE 清除订阅行。

## 数据模型

- `user_follow_tag_categories (user_id → profiles.id, tag_category_id → tag_categories.id)`，`UNIQUE(user_id, tag_category_id)`，`ON DELETE CASCADE`（用户删 / 分类物理删除时一并清理）。
- `user_follow_role_categories` 同理指向 `role_categories`。
- `user_follow_tools (user_id, tool_id, sort_order)`：至多 **20** 条（应用层校验），与收藏表独立，`ON DELETE CASCADE`。
- RLS：与 `favorites` 一致 — **DISABLE**，权限在 Next Server Actions + `getAuthUser()`。

## 进度清单

- [x] 迁移文件创建并写入仓库
- [x] Neon：`neonListUserFollow*Joined`、`neonReplaceUserFollow*`（全量替换）
- [x] `saveAccountFollowsAction` + 页面 `/account/follows`
- [x] UI：启用分类开关矩阵 + 「已失效的关注」区 + 场景/角色工具 Tab + 链向 `/favorites`
- [x] 侧栏「我的关注」入口
- [x] 迁移：`20260508140000_user_follow_tools.sql`
- [x] Neon：`neonListUserFollowToolsForAccount`、`neonReplaceUserFollowTools`、`neonAccountSearchListedToolsForFollows`、`searchToolsForFollowPickerAction`
- [x] UI：`AccountFollowToolMiniTile`、导出 `TOOL_TIP_CONTENT_CLASS`；网格 10 列 · pinned；失效工具条

## 备注

- **禁用**：JOIN 后 `is_disabled = true` → 归入「已失效」，仍可取消订阅。
- **物理删除分类**：CASCADE 会删掉订阅行，用户侧不再显示该项（无法在失效区展示「幽灵」名称）；若产品要强保留名称，需改为软删分类或增加 snapshot 列（本期不做）。
