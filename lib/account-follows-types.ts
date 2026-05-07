import type { Tool } from '@/lib/types'

/** 个人中心「我的关注」pinned 工具上限（勿从 `@/lib/neon/data` 在客户端引用，以免打入 Node 依赖） */
export const ACCOUNT_FOLLOW_TOOLS_MAX = 20

export type UserFollowCategoryJoined = {
  id: string
  name: string
  slug: string
  is_disabled: boolean
  created_at: string
}

export type UserFollowToolEntry = {
  tool_id: string
  sort_order: number
  created_at: string
  tool: Tool
  /** false：驳回 / 隐藏等，订阅仍保留以便提示失效 */
  listing_ok: boolean
}
