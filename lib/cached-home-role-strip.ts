import { unstable_cache } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { HOME_ROLE_CATEGORIES_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

export interface HomeRoleStripItem {
  slug: string
  name: string
  /** 展示用一句话；空则回退为 name */
  tagline: string
  /** Lucide 图标名（如 Briefcase），与场景卡片 icon 一致 */
  icon: string | null
}

async function loadHomeRoleStrip(): Promise<HomeRoleStripItem[]> {
  try {
    const roles = await neon.neonListRoleCategoriesEnabled()
    return roles.map((r) => ({
      slug: r.slug,
      name: r.name,
      tagline: r.tagline?.trim() ? r.tagline.trim() : r.name,
      icon: r.icon,
    }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[home-role-strip] schema not ready, returning empty:',
        e instanceof Error ? e.message : e,
      )
    }
    return []
  }
}

/**
 * 首页「按角色」徽章条：`unstable_cache` + tag `HOME_ROLE_CATEGORIES_CACHE_TAG`。
 */
export const getHomeRoleStrip = unstable_cache(loadHomeRoleStrip, ['home-role-strip'], {
  tags: [HOME_ROLE_CATEGORIES_CACHE_TAG],
  revalidate: 60,
})
