/** 场景 / 角色后台：关联标签、挂载选人、移除选人共用滚动列表高度（与 admin-scene-category-manager 标签列表一致） */
export const ADMIN_TAXONOMY_LIST_SCROLL_CLASS =
  'max-h-[min(520px,55vh)] divide-y divide-border overflow-y-auto rounded-md border overscroll-contain'

/** taxonomy 挂载/移除列表分页大小（与 `neonAdminSearchToolsForTagging` taxonomy 默认一致）；单页最多 50，下一页再查库 */
export const ADMIN_TAXONOMY_TOOL_PAGE_SIZE = 50

/** taxonomy 单次请求条数上限（与 Neon `maxLim` 对齐） */
export const ADMIN_TAXONOMY_TOOL_PAGE_MAX = 50
