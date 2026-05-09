/** 登录用户个人门户首页（板块视图） */
export function accountPortalHomePath(): string {
  return '/account/home'
}

/** 个人门户内工具详情（相对主站 /tool 独立的站内路由） */
export function accountPortalToolPath(slug: string): string {
  const s = (slug ?? '').trim()
  if (!s) return accountPortalHomePath()
  return `/account/home/tool/${encodeURIComponent(s)}`
}

/** 主站公开发布的精选解决方案列表 */
export function excellentSolutionsListPath(): string {
  return '/excellent-ai-solutions'
}

export function excellentSolutionsDetailPath(slug: string): string {
  const s = (slug ?? '').trim()
  if (!s) return excellentSolutionsListPath()
  return `/excellent-ai-solutions/${encodeURIComponent(s)}`
}
