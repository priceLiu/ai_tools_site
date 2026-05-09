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
  /** `null` 表示根级分类（顶层菜单单项直达 `/category/slug`） */
  parent_id: string | null
  sort_order: number
  icon: string | null
  /** 创建分类后把该菜单项 href 写成 `/category/{slug}`（子项原为 # 或与父级重复时尤其需要） */
  navigationMenuItemId?: string
}

/**
 * 对比侧栏树与 categories：
 * 1) 「一级折叠项」下的直接子菜单若缺少对应分类行则计划插入（与侧栏 NavNode 一致）；
 * 2) **任意层级叶子菜单行**（导航表里不作为其它行的 parent）且 `href` 为 `/category/{slug}`，若库里尚无该 slug，亦计划插入；父级优先由 **上一行菜单** 的 `/category/{slug}` 或标题匹配已有根分类解析，失败则 **根级**（保证后台 Tab / 批量导入能选到）。
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

  const rootCatsForSortOrder = categories.filter(
    (c) =>
      c.slug !== 'hot' &&
      (c.parent_id == null || String(c.parent_id).trim() === ''),
  )
  let nextRootOrder =
    rootCatsForSortOrder.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1

  const rowsById = new Map(navRows.map((r) => [r.id, r]))
  const idsWithChildren = new Set<string>()
  for (const r of navRows) {
    if (r.parent_id) idsWithChildren.add(r.parent_id)
  }

  for (const row of navRows) {
    if (idsWithChildren.has(row.id)) continue

    const slug = slugFromCategoryMenuHref(row.href)
    if (!slug || slug === 'hot') continue
    if (slugToCat.has(slug)) continue
    if (seenSlugs.has(slug)) continue

    const label = (row.label || '').trim()

    let parentIdDb: string | null = null
    let inheritedSortBase: number | null = null

    const leafPid = row.parent_id
    if (leafPid) {
      const parentRow = rowsById.get(leafPid)
      if (parentRow) {
        const pSlug = slugFromCategoryMenuHref(parentRow.href)
        let pc: Category | undefined = pSlug ? slugToCat.get(pSlug) : undefined
        if (!pc) {
          pc = topLevelCandidates.find((c) =>
            menuTitleMatchesCategoryName(parentRow.label, c.name),
          )
        }
        if (pc && pc.slug !== 'hot') {
          parentIdDb = pc.id
          inheritedSortBase = pc.sort_order
        }
      }
    }

    const sortOrder =
      inheritedSortBase != null
        ? inheritedSortBase * 1000 + row.sort_order
        : nextRootOrder++

    planned.push({
      name: label || slug,
      slug,
      parent_id: parentIdDb,
      sort_order: sortOrder,
      icon: row.icon_name?.trim() || 'Sparkles',
      navigationMenuItemId: row.id,
    })
    seenSlugs.add(slug)
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
