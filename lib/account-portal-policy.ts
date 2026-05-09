import type { Profile } from '@/lib/types'

/**
 * `/account` 根路径：管理员关闭门户、或用户关闭主页 → 个人信息；
 * 否则进入个人主页门户。
 */
export function accountRootHref(profile: Profile | null): '/account/profile' | '/account/home' {
  if (!profile) return '/account/profile'
  if (profile.portal_disabled_by_admin === true) return '/account/profile'
  if (profile.portal_home_enabled === false) return '/account/profile'
  return '/account/home'
}
