import {
  neonCountChildCategories,
  neonCountToolsInCategory,
  neonDeleteCategoryById,
  neonGetCategoryIdBySlug,
  neonListNavigationAllHrefIdParent,
  neonListNavigationHrefs,
} from '@/lib/neon/data'
import { slugFromCategoryMenuHref } from '@/lib/submit-category-choices'

/** 删除父级菜单前收集子树内所有 href（级联删库后无法再读） */
export async function collectMenuSubtreeHrefsBeforeDelete(
  rootId: string,
): Promise<string[]> {
  const rows = await neonListNavigationAllHrefIdParent()

  if (!rows?.length) return []
  const hrefs = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    const node = rows.find((x) => x.id === cur)
    if (node?.href) hrefs.add(node.href)
    for (const ch of rows) {
      if (ch.parent_id === cur) stack.push(ch.id)
    }
  }
  return [...hrefs]
}

/**
 * 删除菜单项或修改 href 后：若某 slug 已不再被任何菜单引用，且该分类下无工具、无子分类，则删除 categories 行。
 */
export async function tryDeleteOrphanCategoryFromNavHref(
  navHref: string,
): Promise<void> {
  const slug = slugFromCategoryMenuHref(navHref.trim())
  if (!slug || slug === 'hot') return

  const allNav = await neonListNavigationHrefs()
  for (const r of allNav) {
    if (slugFromCategoryMenuHref((r.href ?? '').trim()) === slug) return
  }
  const catId = await neonGetCategoryIdBySlug(slug)
  if (!catId) return
  if ((await neonCountToolsInCategory(catId)) > 0) return
  if ((await neonCountChildCategories(catId)) > 0) return
  await neonDeleteCategoryById(catId)
}
