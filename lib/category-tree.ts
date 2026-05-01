import type { Category, Tool } from '@/lib/types'

type CatRef = Pick<Category, 'id' | 'parent_id'>

/** 统一 id / parent_id 比较，避免 API 返回类型不一致导致子分类在树里「挂不上」 */
function refId(id: string | null | undefined): string | null {
  if (id === undefined || id === null) return null
  const s = String(id).trim()
  return s === '' ? null : s
}

export function idsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ra = refId(a)
  const rb = refId(b)
  if (ra === null || rb === null) return false
  return ra === rb
}

function hasParent(c: Pick<Category, 'parent_id'>): boolean {
  return refId(c.parent_id) !== null
}

export function ascendCategoryToRoot(
  categories: Category[],
  leaf: Category,
): Category {
  let cur = leaf
  while (hasParent(cur)) {
    const p = categories.find((x) => idsEqual(x.id, cur.parent_id))
    if (!p) break
    cur = p
  }
  return cur
}

/**
 * `rootId` 下所有「叶子分类」（无下级），含多级时用深度优先、`sort_order` 排序。
 */
export function leafCategoriesUnderRoot(
  categories: Category[],
  rootId: string,
): Category[] {
  const direct = categories
    .filter((c) => idsEqual(c.parent_id, rootId))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  if (direct.length === 0) return []

  const out: Category[] = []
  for (const d of direct) {
    const hasKids = categories.some((c) => idsEqual(c.parent_id, d.id))
    if (!hasKids) out.push(d)
    else out.push(...leafCategoriesUnderRoot(categories, d.id))
  }
  return out
}

function rootHasSelectableLeaf(
  categories: Category[],
  rootId: string,
  whitelist: Set<string> | null,
): boolean {
  const subs = leafCategoriesUnderRoot(categories, rootId)
  if (subs.length > 0) {
    return subs.some((l) => !whitelist || whitelist.has(l.id))
  }
  const rootHasChild = categories.some((c) => idsEqual(c.parent_id, rootId))
  if (rootHasChild) return false
  return !whitelist || whitelist.has(rootId)
}

/** 某项是否属于给定一级根下的子树（含根自身） */
export function categoryIsUnderRoot(
  categories: Pick<CatRef, 'id' | 'parent_id'>[],
  leafId: string,
  rootId: string,
): boolean {
  let cur: { id: string; parent_id?: string | null } | undefined =
    categories.find((c) => c.id === leafId)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (idsEqual(cur.id, rootId)) return true
    const pid = refId(cur.parent_id)
    if (!pid) break
    cur = categories.find((c) => idsEqual(c.id, pid))
  }
  return false
}

/** 顶层分类（可作一级下拉），排序与 hot 无关 */
export function topLevelCategoryRoots(categories: Category[]): Category[] {
  return categories
    .filter((c) => !hasParent(c) && c.slug !== 'hot')
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/**
 * 可作「一级」展示的分类：`slug !== hot`；
 * - 若为叶子且无中间层下级，仍可单独选一个分类；
 * - 若有下级，则需至少存在一个可选的子孙叶子。
 */
export function pickerRootCategories(
  categories: Category[],
  whitelist: Set<string> | null,
): Category[] {
  return topLevelCategoryRoots(categories).filter((r) =>
    rootHasSelectableLeaf(categories, r.id, whitelist),
  )
}

/** 自选根 + 白名单筛选后的可选叶子列表 */
export function pickerLeavesForRoot(
  categories: Category[],
  rootId: string,
  whitelist: Set<string> | null,
  /** 编辑被拒条目时额外允许这一项（绕过白名单但仍须属于当前根子树或为根自身） */
  extraLeaf?: Category | null,
): Category[] {
  let leaves = leafCategoriesUnderRoot(categories, rootId)

  const rootIsLeaf =
    leaves.length === 0 && !categories.some((c) => idsEqual(c.parent_id, rootId))

  if (rootIsLeaf) {
    const one = categories.find((c) => idsEqual(c.id, rootId))
    leaves = one ? [one] : []
  }

  const wl = whitelist
  let list = wl
    ? leaves.filter((l) => wl.has(l.id))
    : leaves.slice()

  if (
    extraLeaf &&
    !list.some((l) => l.id === extraLeaf.id) &&
    (idsEqual(extraLeaf.id, rootId) ||
      categoryIsUnderRoot(categories, extraLeaf.id, rootId))
  ) {
    list = [...list, extraLeaf]
  }

  list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  return list
}

/** 本级 + 递归子级 id（含祖先自身），用于分类页聚合工具 */
export function collectSubtreeCategoryIds(
  categories: Pick<CatRef, 'id' | 'parent_id'>[],
  rootId: string,
): string[] {
  const byParent = new Map<string, string[]>()
  for (const c of categories) {
    const pk = refId(c.parent_id) ?? '__root__'
    if (!byParent.has(pk)) byParent.set(pk, [])
    byParent.get(pk)!.push(c.id)
  }
  const rootKey = refId(rootId) ?? rootId
  const out: string[] = [rootKey]
  const queue = [...(byParent.get(rootKey) ?? [])]
  while (queue.length) {
    const id = queue.shift()!
    out.push(id)
    const pid = refId(id) ?? id
    const ch = byParent.get(pid)
    if (ch?.length) queue.push(...ch)
  }
  return out
}

export function leafCategoriesOnly(categories: Category[]): Category[] {
  return categories.filter(
    (c) => !categories.some((x) => idsEqual(x.parent_id, c.id)),
  )
}

export type LeafToolSectionRow = {
  category: Category
  tools: Tool[]
}

/**
 * 首页：把叶子分类对应的工具版块按 ascend 的一级根归类，版块顺序与各根下的叶子沿用 sort_order。
 */
export function groupLeafToolSectionsByRoot(
  categories: Category[],
  rows: LeafToolSectionRow[],
): { root: Category; sections: LeafToolSectionRow[] }[] {
  const byRootId = new Map<string, LeafToolSectionRow[]>()
  for (const row of rows) {
    const root = ascendCategoryToRoot(categories, row.category)
    const list = byRootId.get(root.id) ?? []
    list.push(row)
    byRootId.set(root.id, list)
  }

  const sortSections = (s: LeafToolSectionRow[]) =>
    [...s].sort(
      (a, b) =>
        a.category.sort_order - b.category.sort_order ||
        a.category.name.localeCompare(b.category.name),
    )

  const primaryOrderIds = pickerRootCategories(categories, null).map((r) => r.id)

  const out: { root: Category; sections: LeafToolSectionRow[] }[] = []
  const used = new Set<string>()

  for (const rid of primaryOrderIds) {
    const sec = byRootId.get(rid)
    if (!sec?.length) continue
    const root = categories.find((c) => c.id === rid)
    if (!root) continue
    used.add(rid)

    out.push({ root, sections: sortSections(sec) })
  }

  const extraIds = [...byRootId.keys()]
    .filter((id) => !used.has(id))
    .sort((a, b) => {
      const ra = categories.find((c) => c.id === a)
      const rb = categories.find((c) => c.id === b)
      return (
        (ra?.sort_order ?? 0) - (rb?.sort_order ?? 0) ||
        (ra?.name ?? '').localeCompare(rb?.name ?? '')
      )
    })

  for (const rid of extraIds) {
    const root = categories.find((c) => c.id === rid)
    const sec = byRootId.get(rid)
    if (!root || !sec?.length) continue

    out.push({ root, sections: sortSections(sec) })
  }

  return out
}
