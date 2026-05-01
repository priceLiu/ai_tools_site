import { cache } from 'react'
import { createPublicSupabase } from '@/lib/supabase/public'
import type { NavigationMenuItemRow, NavigationMenuTreeNode } from '@/lib/types'

export function buildNavigationTree(
  rows: NavigationMenuItemRow[],
): NavigationMenuTreeNode[] {
  const mapped = rows.map((r) => ({
    ...r,
    children: [] as NavigationMenuTreeNode[],
  }))
  const byId = new Map(mapped.map((n) => [n.id, n]))
  const roots: NavigationMenuTreeNode[] = []
  for (const node of mapped) {
    const pid = node.parent_id
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (list: NavigationMenuTreeNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order)
    list.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** 侧栏公开的可见菜单树（站内匿名可读） */
export const getNavigationMenuTree = cache(async (): Promise<
  NavigationMenuTreeNode[]
> => {
  const supabase = createPublicSupabase()
  const { data, error } = await supabase
    .from('navigation_menu_items')
    .select('id,parent_id,label,href,icon_name,sort_order,is_visible')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  if (error || !data?.length) return []
  return buildNavigationTree(data as NavigationMenuItemRow[])
})
