import { buildNavigationTree } from '@/lib/navigation-tree'
import {
  menuTitleMatchesCategoryName,
  slugFromCategoryMenuHref,
} from '@/lib/submit-category-choices'
import type { Category, NavigationMenuItemRow } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PlannedCategoryInsert = {
  name: string
  slug: string
  parent_id: string
  sort_order: number
  icon: string | null
}

/**
 * 对比侧栏树与 categories：对「一级折叠项」下的子菜单，若 href 为 /category/{slug} 且
 * categories 尚无该 slug，则计划插入一条（parent_id 为父级分类 id）。
 * 仅处理侧栏的一层子项（与 NavNode 行为一致）。
 */
export function planMissingCategoriesFromNavigation(
  navRows: NavigationMenuItemRow[],
  categories: Category[],
): PlannedCategoryInsert[] {
  const slugToCat = new Map(categories.map((c) => [c.slug, c]))
  const tree = buildNavigationTree(navRows)
  const planned: PlannedCategoryInsert[] = []
  const seenSlugs = new Set<string>()

  const topLevelCandidates = categories.filter(
    (c) =>
      c.slug !== 'hot' &&
      (c.parent_id == null || String(c.parent_id).trim() === ''),
  )

  for (const root of tree) {
    if (root.children.length === 0) continue

    let parentCat: Category | undefined
    const parentSlug = slugFromCategoryMenuHref(root.href)
    if (parentSlug) parentCat = slugToCat.get(parentSlug)

    if (!parentCat) {
      parentCat = topLevelCandidates.find((c) =>
        menuTitleMatchesCategoryName(root.label, c.name),
      )
    }
    if (!parentCat) continue

    const sortedChildren = [...root.children].sort(
      (a, b) => a.sort_order - b.sort_order,
    )
    for (const ch of sortedChildren) {
      const chSlug = slugFromCategoryMenuHref(ch.href)
      if (!chSlug || chSlug === 'hot') continue
      if (slugToCat.has(chSlug) || seenSlugs.has(chSlug)) continue

      planned.push({
        name: (ch.label || '').trim() || chSlug,
        slug: chSlug,
        parent_id: parentCat.id,
        sort_order: parentCat.sort_order * 1000 + ch.sort_order,
        icon: ch.icon_name?.trim() || 'Sparkles',
      })
      seenSlugs.add(chSlug)
    }
  }

  return planned
}

export async function syncMissingCategoriesFromNavigation(
  supabase: SupabaseClient,
  navRows: NavigationMenuItemRow[],
  categories: Category[],
): Promise<{ created: number; slugs: string[]; errors: string[] }> {
  const planned = planMissingCategoriesFromNavigation(navRows, categories)
  const slugs: string[] = []
  const errors: string[] = []

  for (const row of planned) {
    const { error } = await supabase.from('categories').insert({
      name: row.name,
      slug: row.slug,
      parent_id: row.parent_id,
      sort_order: row.sort_order,
      icon: row.icon,
    })
    if (error) {
      errors.push(`${row.slug}: ${error.message}`)
    } else {
      slugs.push(row.slug)
    }
  }

  return { created: slugs.length, slugs, errors }
}
