import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import {
  neonListDisabledMenuCategorySlugs,
  neonListNavigationMenuVisible,
} from '@/lib/neon/data'
import type { NavigationMenuItemRow, NavigationMenuTreeNode } from '@/lib/types'
import {
  buildNavigationTree,
  pruneNavigationTreeDisabledCategoryLinks,
} from '@/lib/navigation-tree'
import {
  NAVIGATION_MENU_CACHE_REVALIDATE_SECONDS,
  NAVIGATION_MENU_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

export {
  NAVIGATION_MENU_CACHE_REVALIDATE_SECONDS,
  NAVIGATION_MENU_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

/** 仅查库建树，无 headers；可供其它 Data Cache 内部调用（避免 unstable_cache 嵌套 dynamic）。 */
export async function loadNavigationMenuTree(): Promise<
  NavigationMenuTreeNode[]
> {
  const data = await neonListNavigationMenuVisible()
  if (!data?.length) return []
  let disabledSlugs: string[] = []
  try {
    disabledSlugs = await neonListDisabledMenuCategorySlugs()
  } catch {
    disabledSlugs = []
  }
  const tree = buildNavigationTree(data as NavigationMenuItemRow[])
  if (!disabledSlugs.length) return tree
  return pruneNavigationTreeDisabledCategoryLinks(tree, new Set(disabledSlugs))
}

const getNavigationMenuCached = unstable_cache(loadNavigationMenuTree, [
  'navigation-menu-tree-v1',
],
  {
    revalidate: NAVIGATION_MENU_CACHE_REVALIDATE_SECONDS,
    tags: [NAVIGATION_MENU_CACHE_TAG],
  },
)

/** 浏览器强刷新（no-cache）时跳过 Data Cache，与首页工具缓存策略一致 */
export async function getNavigationMenuTree(): Promise<
  NavigationMenuTreeNode[]
> {
  const h = await headers()
  const cacheControl = h.get('cache-control')?.toLowerCase() ?? ''
  const pragma = h.get('pragma')?.toLowerCase() ?? ''
  const bypassCache =
    pragma.includes('no-cache') ||
    cacheControl.includes('no-cache') ||
    cacheControl.includes('max-age=0')

  try {
    if (bypassCache) {
      return await loadNavigationMenuTree()
    }
    return await getNavigationMenuCached()
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[getNavigationMenuTree] Neon 不可用，返回空菜单（不影响页面渲染）:',
        e,
      )
    }
    return []
  }
}

/**
 * 静态/ISR 页面专用：不读 `headers()`，不会让路由退回 dynamic。
 * 失败时返回空数组，与 `getNavigationMenuTree` 行为一致。
 */
export async function getNavigationMenuTreeStatic(): Promise<
  NavigationMenuTreeNode[]
> {
  try {
    return await getNavigationMenuCached()
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[getNavigationMenuTreeStatic] Neon 不可用，返回空菜单:',
        e,
      )
    }
    return []
  }
}
