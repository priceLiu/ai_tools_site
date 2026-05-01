import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { createPublicSupabase } from '@/lib/supabase/public'
import type { NavigationMenuItemRow, NavigationMenuTreeNode } from '@/lib/types'
import { buildNavigationTree } from '@/lib/navigation-tree'
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
  const supabase = createPublicSupabase()
  const { data, error } = await supabase
    .from('navigation_menu_items')
    .select('id,parent_id,label,href,icon_name,sort_order,is_visible')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  if (error || !data?.length) return []
  return buildNavigationTree(data as NavigationMenuItemRow[])
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

  if (bypassCache) {
    return loadNavigationMenuTree()
  }
  return getNavigationMenuCached()
}
