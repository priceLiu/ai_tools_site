export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  /** 父分类 id；null 为一级分类 */
  parent_id?: string | null
  created_at: string
}

export interface Tool {
  id: string
  name: string
  slug: string
  description: string
  website_url: string
  logo_url: string | null
  screenshot_url: string | null
  category_id: string | null
  user_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  /** Filled when status is rejected; shown to submitter in 我的提交 */
  rejection_reason: string | null
  is_featured: boolean
  view_count: number
  /** 收藏人数，与 `favorites` 表由触发器同步 */
  favorite_count?: number
  introduction: string | null
  use_cases: string | null
  created_at: string
  updated_at: string
  category?: Category
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface Favorite {
  id: string
  user_id: string
  tool_id: string
  created_at: string
  tool?: Tool
}

export interface ToolComment {
  id: string
  tool_id: string
  body: string
  nickname: string
  email: string
  website: string | null
  created_at: string
}

export interface NavigationMenuItemRow {
  id: string
  parent_id: string | null
  label: string
  href: string
  icon_name: string | null
  sort_order: number
  is_visible: boolean
}

export interface NavigationMenuTreeNode extends NavigationMenuItemRow {
  children: NavigationMenuTreeNode[]
}
