import type { IntroductionFormat } from './introduction-format'

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  /** 父分类 id；null 为一级分类 */
  parent_id?: string | null
  created_at: string
  /** 禁用后前台分类页与导航入口隐藏；工具仍可挂在 category_id（展示时不带出分类 JOIN） */
  is_disabled?: boolean
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
  /** 管理员禁用后前台不展示；缺省视为 false */
  is_disabled?: boolean
  view_count: number
  /** 收藏人数，与 `favorites` 表由触发器同步 */
  favorite_count?: number
  /** 详情页正文：纯文本 / Markdown / HTML */
  introduction: string | null
  /** 与 introduction 对应的渲染方式 */
  /** 与 introduction 对应的渲染方式 */
  introduction_format?: IntroductionFormat
  use_cases: string | null
  created_at: string
  updated_at: string
  category?: Category
  /** 详情接口：tool_tags → tags */
  tool_tags?: ToolTagLink[]
}

export interface ToolTagLink {
  sort_order: number
  tag: { id: string; name: string }
}

/** 场景分类（`tag_categories`，与左侧产品线 `categories` 解耦） */
export interface TagCategory {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  description: string | null
  created_at: string
  /** 禁用后前台不展示该场景分类本体页与首页卡片（标签数据仍保留） */
  is_disabled?: boolean
}

/** 角色分类（`role_categories`）：首页「按角色」入口与 `/role/[slug]` */
export interface RoleCategory {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  tagline: string | null
  description: string | null
  created_at: string
  /** 禁用后前台隐去本品与对应角色聚合页、sitemap（标签与联结不删） */
  is_disabled?: boolean
}

/** 标签（含 curated 元信息） */
export interface TagRow {
  id: string
  name: string
  tag_category_id: string | null
  /** 最近一次变更场景归属的时间；后台场景下列表按此倒序（缺列迁移前可为空） */
  tag_category_linked_at?: string | null
  is_curated: boolean
  aliases: string[]
  created_at: string
  /** 禁用后前台不展示该标签（聚合页 / chip / 工具上标签栏） */
  is_disabled?: boolean
}

/** 管理后台：标签 + 工具数 + 一级分类名 */
export interface AdminTagRow extends TagRow {
  /** 关联工具数（COUNT(tool_tags)） */
  tool_count: number
  /** 场景分类名（如有） */
  category_name: string | null
  /** 场景分类 slug（如有） */
  category_slug: string | null
}


/**
 * 首页 bundle / 列表卡片展示所需字段（不含 introduction、use_cases 等大列），
 * 避免 `unstable_cache` 序列化超过 Next.js Data Cache 2MB 上限。
 */
export type HomeListedTool = Pick<
  Tool,
  | 'id'
  | 'name'
  | 'slug'
  | 'description'
  | 'logo_url'
  | 'category_id'
  | 'view_count'
  | 'is_featured'
  | 'status'
  | 'created_at'
  | 'updated_at'
> &
  Partial<Pick<Tool, 'favorite_count' | 'is_disabled'>> & {
    category?: Category
    /** 列表查询通常不带；tooltip 回退到 description */
    introduction?: string | null
  }

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  /** true 时禁止登录使用（中间件会退出会话） */
  is_disabled?: boolean
  /** 管理员禁用时填写；解除禁用时为空 */
  disabled_reason?: string | null
  /** 管理员禁言后禁止发表评论 */
  comment_muted?: boolean
  /** 禁言原因；解除时可空 */
  comment_mute_reason?: string | null
  /** 管理员用户列表：关联 auth_credentials.email */
  registration_email?: string | null
  created_at: string
}

/** 站点会话用户（邮箱密码登录，id 与 profiles.id 一致） */
export type AuthUser = { id: string; email: string }

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
  /** 发表评论的登录用户 id；历史数据可能为空 */
  user_id?: string | null
  /** 管理端可见；前台列表不返回为 true 的评论 */
  is_hidden?: boolean
}

/** 管理后台评论列表行 */
export interface AdminCommentRow extends ToolComment {
  tool_name: string
  tool_slug: string
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

/** 首页广告位投放（与 tools 多对多：同一工具可有多条不同时段的投放） */
export interface AdPlacement {
  id: string
  tool_id: string
  placement: 'section1' | 'section2'
  /** section1: 'A' / 'B' / 'C'；section2: null */
  tab_key: 'A' | 'B' | 'C' | null
  /** section2 必填；前端通过 /api/img/ad/<id> 代理 */
  banner_url: string | null
  price: number
  starts_at: string
  ends_at: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  sort_order: number
  submitted_by: string | null
  created_at: string
  updated_at: string
  /** 关联读取时一起带出 */
  tool?: Pick<Tool, 'id' | 'name' | 'slug' | 'logo_url' | 'description'>
}

/** 全局广告位设置（存于 app_kv，key = `ad:settings`） */
export interface AdSettings {
  /** 总开关，关闭后首页两个版块整体不渲染 */
  enabled_section1: boolean
  enabled_section2: boolean
  section1_tab_a_label: string
  section1_tab_b_label: string
  section1_tab_c_label: string
  /** Section 2 自动轮播秒数，最小 3 */
  section2_rotate_seconds: number
  /** 用户提交时的参考价（人民币） */
  default_price_section1: number
  default_price_section2: number
}
