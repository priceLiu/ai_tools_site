import type { NavigationMenuItemRow, NavigationMenuTreeNode } from '@/lib/types'
import { normalizeNavMenuHref } from '@/lib/trim-or-null'

/** 纯函数：无 next/server 依赖，可供 Client Components 使用。 */
export function buildNavigationTree(
  rows: NavigationMenuItemRow[],
): NavigationMenuTreeNode[] {
  const mapped = rows.map((r) => ({
    ...r,
    href: normalizeNavMenuHref(r.href),
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
