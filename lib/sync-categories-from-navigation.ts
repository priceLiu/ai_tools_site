import { idsEqual } from '@/lib/category-tree'
import { buildNavigationTree } from '@/lib/navigation-tree'
import {
  menuTitleMatchesCategoryName,
  slugFromCategoryMenuHref,
} from '@/lib/submit-category-choices'
import type { Category, NavigationMenuItemRow } from '@/lib/types'
import {
  neonInsertCategory,
  neonUpdateNavigationItemHref,
} from '@/lib/neon/data'

function uniqueSlugFromNavChildLabel(
  label: string,
  parentCat: Category,
  slugToCat: Map<string, Category>,
  seenSlugs: Set<string>,
): string | null {
  const raw = label.normalize('NFKC').trim().toLowerCase()
  if (!raw) return null
  let base = raw
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base || base.length < 2) {
    base = `sub-${parentCat.slug}`
  }
  const candidates = [base, `${parentCat.slug}-${base}`, `${base}-tools`]
  for (const c of candidates) {
    if (!c) continue
    if (!slugToCat.has(c) && !seenSlugs.has(c)) return c
  }
  for (let i = 2; i < 300; i++) {
    const c = `${parentCat.slug}-${base}-${i}`
    if (!slugToCat.has(c) && !seenSlugs.has(c)) return c
  }
  return null
}

export type PlannedCategoryInsert = {
  name: string
  slug: string
  parent_id: string
  sort_order: number
  icon: string | null
  /** 创建分类后把该菜单项 href 写成 `/category/{slug}`（子项原为 # 或与父级重复时尤其需要） */
  navigationMenuItemId?: string
}

/**
 * 对比侧栏树与 categories：「一级折叠项」下的直接子菜单若缺少对应分类行则计划插入：
 * - 子项含有效且不等于父级 slug 的 `/category/xxx` 时，用该 slug；
 * - 否则在父分类下按子项标题生成唯一 slug。
 * 仅处理一层子项（与侧栏 NavNode 一致）。
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
      const rawSlug = slugFromCategoryMenuHref(ch.href)
      const chSlug =
        rawSlug && rawSlug !== 'hot' && rawSlug !== parentCat.slug
          ? rawSlug
          : null
      const label = (ch.label || '').trim()

      if (chSlug && !slugToCat.has(chSlug) && !seenSlugs.has(chSlug)) {
        planned.push({
          name: label || chSlug,
          slug: chSlug,
          parent_id: parentCat.id,
          sort_order: parentCat.sort_order * 1000 + ch.sort_order,
          icon: ch.icon_name?.trim() || 'Sparkles',
          navigationMenuItemId: ch.id,
        })
        seenSlugs.add(chSlug)
        continue
      }

      if (chSlug && slugToCat.has(chSlug)) continue

      if (!label) continue

      const existingUnderParent = categories.find(
        (c) =>
          c.slug !== 'hot' &&
          idsEqual(c.parent_id, parentCat.id) &&
          menuTitleMatchesCategoryName(label, c.name),
      )
      if (existingUnderParent) continue

      const gen = uniqueSlugFromNavChildLabel(
        label,
        parentCat,
        slugToCat,
        seenSlugs,
      )
      if (!gen) continue

      planned.push({
        name: label,
        slug: gen,
        parent_id: parentCat.id,
        sort_order: parentCat.sort_order * 1000 + ch.sort_order,
        icon: ch.icon_name?.trim() || 'Sparkles',
        navigationMenuItemId: ch.id,
      })
      seenSlugs.add(gen)
    }
  }

  return planned
}

export async function syncMissingCategoriesFromNavigation(
  navRows: NavigationMenuItemRow[],
  categories: Category[],
): Promise<{ created: number; slugs: string[]; errors: string[] }> {
  const planned = planMissingCategoriesFromNavigation(navRows, categories)
  const slugs: string[] = []
  const errors: string[] = []

  for (const row of planned) {
    try {
      await neonInsertCategory({
        name: row.name,
        slug: row.slug,
        parent_id: row.parent_id,
        sort_order: row.sort_order,
        icon: row.icon,
      })
      slugs.push(row.slug)
      if (row.navigationMenuItemId) {
        try {
          await neonUpdateNavigationItemHref(
            row.navigationMenuItemId,
            `/category/${row.slug}`,
            new Date().toISOString(),
          )
        } catch (navErr) {
          errors.push(
            `分类「${row.slug}」已创建，但菜单链接未更新：${navErr instanceof Error ? navErr.message : String(navErr)}`,
          )
        }
      }
    } catch (e) {
      errors.push(
        `${row.slug}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }
  return { created: slugs.length, slugs, errors }
}
