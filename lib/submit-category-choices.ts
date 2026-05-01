import type { Category, NavigationMenuTreeNode } from '@/lib/types'
import { ascendCategoryToRoot, idsEqual } from '@/lib/category-tree'

/** 与侧栏一致的分类链接：站内 /category/{slug}，亦兼容绝对 URL、无前导 / */
export function slugFromCategoryMenuHref(href: string): string | null {
  const raw = href.trim()
  if (!raw) return null

  let path = raw
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      path = new URL(raw).pathname
    } catch {
      return null
    }
  }

  path = path.split('?')[0]?.split('#')[0] ?? ''
  path = path.replace(/\/+$/, '')
  if (!path) path = '/'

  // 标准：/category/slug（或尾随 /）
  let m = /\/category\/([^/?#]+)\/?$/.exec(path)
  if (m) return decodeURIComponent(m[1])

  // 无前导 slash：category/slug
  m = /^category\/([^/?#]+)\/?$/i.exec(path.replace(/^\//, ''))
  if (m) return decodeURIComponent(m[1])

  // 路径中带前缀片段时（如网关、子路径）：取最后一次出现的 /category/slug
  const all = [...path.matchAll(/\/category\/([^/?#]+)/gi)]
  if (all.length > 0) {
    const last = all[all.length - 1][1]
    return decodeURIComponent(last)
  }

  return null
}

/**
 * 菜单文案与 categories.name 对齐时，忽略空白/大小写差异，
 * 避免「AI 对话」与「AI对话」导致父级对不上、同步跳过、首页二级版块缺失。
 */
export function menuTitleMatchesCategoryName(
  menuLabel: string,
  categoryName: string,
): boolean {
  const norm = (s: string) =>
    s.normalize('NFKC').trim().replace(/\s+/g, '').toLowerCase()
  const a = norm(menuLabel)
  const b = norm(categoryName)
  return a.length > 0 && a === b
}

function walkCollectSlugs(nodes: NavigationMenuTreeNode[], out: Set<string>) {
  for (const n of nodes) {
    const s = slugFromCategoryMenuHref(n.href)
    if (s && s !== 'hot') out.add(s)
    if (n.children.length) walkCollectSlugs(n.children, out)
  }
}

/**
 * 菜单里出现过的 `/category/*` slug 映射为 category id；若没有（菜单无分类链接）则返回 null 表示不按菜单限制。
 * （菜单驱动的一级/二级下拉不再用该集合过滤，避免因 slug/id 与白名单推导不一致整块分组被丢掉。）
 */
export function navigationMenuCategoryIdWhitelist(
  navigation: NavigationMenuTreeNode[],
  categories: Category[],
): Set<string> | null {
  const slugs = new Set<string>()
  walkCollectSlugs(navigation, slugs)
  if (slugs.size === 0) return null
  const ids = new Set<string>()
  for (const c of categories) {
    if (slugs.has(c.slug)) ids.add(c.id)
  }
  if (ids.size === 0) return null
  return ids
}

/** 提交页：菜单驱动的一级分组 + 可选二级（子菜单中的分类） */
export type SubmitNavigationCategoryTier1 =
  | {
      kind: 'menu_group'
      navParentId: string
      label: string
      children: { categoryId: string; label: string }[]
    }
  | {
      kind: 'menu_leaf'
      categoryId: string
      label: string
    }

export function navigationTier1ContainsCategoryId(
  rows: SubmitNavigationCategoryTier1[],
  categoryId: string,
): boolean {
  for (const r of rows) {
    if (r.kind === 'menu_leaf' && r.categoryId === categoryId) return true
    if (
      r.kind === 'menu_group' &&
      r.children.some((c) => c.categoryId === categoryId)
    )
      return true
  }
  return false
}

/** 侧栏一层子菜单与分类对齐（菜单名 / href / 父级偏置 / 全局唯一 slug·name） */
function sidebarDirectChildCategories(
  foldNode: NavigationMenuTreeNode,
  slugToCat: Map<string, Category>,
  categories: Category[],
  parentCat: Category | undefined,
): { categoryId: string; label: string }[] {
  const out: { categoryId: string; label: string }[] = []
  const seen = new Set<string>()
  const sortedChildren = [...foldNode.children].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  for (const ch of sortedChildren) {
    const menuLabelRaw = `${(ch.label ?? '').trim()}`.trim()
    const cat = resolveCategoryFromMenuChildRow(
      ch,
      slugToCat,
      categories,
      parentCat,
    )
    if (!cat || seen.has(cat.id)) continue
    seen.add(cat.id)
    const lab = menuLabelRaw || cat.name
    out.push({ categoryId: cat.id, label: lab })
  }
  return out
}

function stripParentDuplicates(
  items: { categoryId: string; label: string }[],
  parent?: Category,
): { categoryId: string; label: string }[] {
  if (!parent?.id || items.length === 0) return items
  const sans = items.filter((it) => !idsEqual(it.categoryId, parent.id))
  // 子菜单若全部指向父分类自身链接，不产生有效「二级」——继续走 DB parent_id
  return sans.length > 0 ? sans : []
}

/** 子菜单下 slug → 显示名（兜底用） */
function menuSlugLabelMap(
  nodes: NavigationMenuTreeNode[],
): Map<string, string> {
  const m = new Map<string, string>()
  function walk(ns: NavigationMenuTreeNode[]) {
    const sorted = [...ns].sort((a, b) => a.sort_order - b.sort_order)
    for (const n of sorted) {
      const slug = slugFromCategoryMenuHref(n.href)
      if (slug && slug !== 'hot' && !m.has(slug)) {
        const lb = (n.label || '').trim()
        if (lb) m.set(slug, lb)
      }
      if (n.children.length > 0) walk(n.children)
    }
  }
  walk(nodes)
  return m
}

/** 归类：顶级（parent_id 为空）中与菜单标题同名；多条则取排序靠前的一条 */
function rootCategoryMatchingMenuTitle(
  node: NavigationMenuTreeNode,
  categories: Category[],
): Category | undefined {
  const title = node.label?.trim()
  if (!title) return undefined
  const matches = categories.filter(
    (c) =>
      c.slug !== 'hot' &&
      (c.parent_id ?? null) === null &&
      menuTitleMatchesCategoryName(title, c.name),
  )
  if (matches.length === 0) return undefined
  matches.sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )
  return matches[0]
}

/**
 * 将折叠下的一层子菜单行解析成分类。
 * 「菜单上级」≠ categories.parent_id 时仍可：按 href、按菜单名当 slug/name 匹配、或由子类反推父类。
 */
function resolveCategoryFromMenuChildRow(
  ch: NavigationMenuTreeNode,
  slugToCat: Map<string, Category>,
  categories: Category[],
  parentBias?: Category,
): Category | undefined {
  const menuLabelRaw = `${(ch.label ?? '').trim()}`.trim()
  const hrefSlug = slugFromCategoryMenuHref(ch.href)

  if (hrefSlug && hrefSlug !== 'hot') {
    const c = slugToCat.get(hrefSlug)
    if (c) return c
  }

  if (parentBias?.id && menuLabelRaw) {
    const pid = parentBias.id
    const under = categories.filter(
      (x) =>
        x.slug !== 'hot' &&
        idsEqual(x.parent_id, pid) &&
        menuTitleMatchesCategoryName(menuLabelRaw, x.name),
    )
    if (under.length === 1) return under[0]
    under.sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    )
    if (under.length > 1) return under[0]
  }

  if (menuLabelRaw) {
    const viaSlug =
      slugToCat.get(menuLabelRaw) ??
      slugToCat.get(menuLabelRaw.toLowerCase())
    if (viaSlug && viaSlug.slug !== 'hot') return viaSlug

    const sameName = categories.filter(
      (x) =>
        x.slug !== 'hot' && menuTitleMatchesCategoryName(menuLabelRaw, x.name),
    )
    if (sameName.length === 1) return sameName[0]

    const low = menuLabelRaw.toLowerCase()
    const sameSlug = categories.filter(
      (x) =>
        x.slug !== 'hot' &&
        (x.slug === menuLabelRaw || x.slug.toLowerCase() === low),
    )
    if (sameSlug.length === 1) return sameSlug[0]
  }

  return undefined
}

/** 子类在表里若带 parent_id，可唯一反推出根分类（与菜单小节一致） */
function inferFoldParentCategoryFromChildren(
  node: NavigationMenuTreeNode,
  slugToCat: Map<string, Category>,
  categories: Category[],
): Category | undefined {
  const parentIds = new Set<string>()
  for (const ch of [...node.children].sort(
    (a, b) => a.sort_order - b.sort_order,
  )) {
    const cand = resolveCategoryFromMenuChildRow(
      ch,
      slugToCat,
      categories,
      undefined,
    )
    const pid = cand?.parent_id
    if (!pid || pid === cand?.id) continue
    parentIds.add(pid)
  }
  if (parentIds.size !== 1) return undefined
  const onlyId = [...parentIds][0]
  return categories.find((c) => c.slug !== 'hot' && c.id === onlyId)
}

/**
 * 折叠分组对应的「父分类」（用于 parent_id / 去重）。
 * 常见配置错误：父行 href 误填某个子类的 `/category/{slug}`，此时应用「标题 + 同名根分类」盖住 href，
 * 才能用 categories.parent_id 枚举出 pic1 等真正子分类。
 */
function resolveFoldGroupParentCategory(
  node: NavigationMenuTreeNode,
  slugToCat: Map<string, Category>,
  categories: Category[],
): Category | undefined {
  const titleRoot = (): Category | undefined =>
    rootCategoryMatchingMenuTitle(node, categories)

  const h = node.href?.trim() ?? ''
  const looksLikeGroupingOnly =
    !h || h === '#' || h === '/' || h.startsWith('#')

  if (looksLikeGroupingOnly) return titleRoot()

  const slug = slugFromCategoryMenuHref(node.href)
  if (!slug || slug === 'hot') return titleRoot()

  const hrefCat = slugToCat.get(slug)
  if (!hrefCat) return titleRoot()

  if (node.children.length === 0) return hrefCat

  const hrefCatHasSubsInDb = categories.some(
    (x) => x.slug !== 'hot' && idsEqual(x.parent_id, hrefCat.id),
  )

  const r = titleRoot()
  // 带子菜单时分组父级应当是「一节」的根；href 点到的是表里无下级叶子时多为误填的子类 slug
  if (!hrefCatHasSubsInDb && r && r.id !== hrefCat.id) return r

  return hrefCat
}

/**
 * 二级候选（严格顺序）。
 * 侧栏只对「根级」折叠下发一层 LeafLink（不递归折叠），此处只用直接子行的 href → 分类；
 * 不再扫子树下深层 `/category`，避免提交页多出侧栏看不见的项。
 *
 * 1) 折叠节点「直接子行」：href→`/category/…`，或 **href 不可用**时用「菜单名称 + categories.parent_id + name」对齐（与后台子项写法一致）。
 * 2) 仍无：`categories.parent_id` 子分类（数据补全）
 * 3) 父分类自身兜底
 */
function foldableCategoryItems(
  node: NavigationMenuTreeNode,
  slugToCat: Map<string, Category>,
  categories: Category[],
): { categoryId: string; label: string }[] {
  let parentCat = resolveFoldGroupParentCategory(
    node,
    slugToCat,
    categories,
  )

  const inferredFromChildren = inferFoldParentCategoryFromChildren(
    node,
    slugToCat,
    categories,
  )
  if (inferredFromChildren?.id) {
    if (!parentCat) parentCat = inferredFromChildren
    else {
      const resolvedHasDbKids = categories.some(
        (x) => x.slug !== 'hot' && idsEqual(x.parent_id, parentCat!.id),
      )
      if (!resolvedHasDbKids) parentCat = inferredFromChildren
    }
  }

  const direct = stripParentDuplicates(
    sidebarDirectChildCategories(
      node,
      slugToCat,
      categories,
      parentCat,
    ),
    parentCat,
  )

  const menuLabs = menuSlugLabelMap(node.children)
  const fromDb: { categoryId: string; label: string }[] = []
  if (parentCat?.id) {
    for (const c of categories
      .filter(
        (x) =>
          x.slug !== 'hot' && idsEqual(x.parent_id, parentCat!.id),
      )
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      )) {
      fromDb.push({
        categoryId: c.id,
        label: (menuLabs.get(c.slug)?.trim() || c.name).trim() || c.name,
      })
    }
  }

  const byId = new Map<string, { categoryId: string; label: string }>()
  for (const it of direct) {
    byId.set(it.categoryId, it)
  }
  for (const it of fromDb) {
    if (!byId.has(it.categoryId)) byId.set(it.categoryId, it)
  }

  if (parentCat?.id) {
    const sortedChildren = [...node.children].sort(
      (a, b) => a.sort_order - b.sort_order,
    )
    for (const ch of sortedChildren) {
      const lab = (ch.label ?? '').trim()
      if (!lab) continue
      const sameNameCount = categories.filter(
        (x) => x.slug !== 'hot' && menuTitleMatchesCategoryName(lab, x.name),
      ).length
      const hit = categories.find((x) => {
        if (
          x.slug === 'hot' ||
          !menuTitleMatchesCategoryName(lab, x.name) ||
          byId.has(x.id)
        ) {
          return false
        }
        if (idsEqual(x.parent_id, parentCat!.id)) return true
        const looseParent =
          (x.parent_id == null || String(x.parent_id).trim() === '') &&
          sameNameCount === 1
        return looseParent
      })
      if (hit) {
        byId.set(hit.id, { categoryId: hit.id, label: lab })
      }
    }
  }

  let merged = stripParentDuplicates([...byId.values()], parentCat)
  if (merged.length > 0) return merged

  if (parentCat) {
    return [
      {
        categoryId: parentCat.id,
        label: `${parentCat.name}`.trim() || parentCat.name,
      },
    ]
  }

  return []
}

/**
 * 提交页菜单结构 —— **与侧栏完全一致**：
 * - 侧栏只对 `navigation` 的**根节点**逐个渲染 NavNode（有 children 的为折叠分组，无二层嵌套折叠）；
 *   故此处只为**根级**带 children 的节点生成 menu_group。
 * - 分组下二级选项 = 直接子菜单行：先有 `/category/…`，否则在给定父分类时按菜单「名称」与 `categories.name` 匹配同一 `parent_id` 下的分类（例如 href `/`）。
 * - 根级无 children、且 href 指向分类：一级 menu_leaf。
 */
export function buildSubmitNavigationTier1List(
  navigation: NavigationMenuTreeNode[],
  categories: Category[],
): SubmitNavigationCategoryTier1[] {
  const slugToCat = new Map(categories.map((c) => [c.slug, c]))
  const out: SubmitNavigationCategoryTier1[] = []

  const roots = [...navigation].sort((a, b) => a.sort_order - b.sort_order)
  for (const node of roots) {
    if (node.children.length > 0) {
      const items = foldableCategoryItems(node, slugToCat, categories)
      if (items.length > 0) {
        out.push({
          kind: 'menu_group',
          navParentId: node.id,
          label: node.label.trim() || '分组',
          children: items,
        })
      }
    }
  }

  const groupedIds = new Set<string>()
  for (const row of out) {
    if (row.kind !== 'menu_group') continue
    for (const c of row.children) groupedIds.add(c.categoryId)
  }

  for (const node of roots) {
    if (node.children.length > 0) continue
    const slug = slugFromCategoryMenuHref(node.href)
    if (!slug || slug === 'hot') continue
    const cat = slugToCat.get(slug)
    if (!cat) continue
    if (groupedIds.has(cat.id)) continue
    out.push({
      kind: 'menu_leaf',
      categoryId: cat.id,
      label: (node.label || cat.name).trim() || cat.name,
    })
  }

  return out
}

/** 首页版块：与侧栏同一套菜单分组解析子分类（不依赖 categories.parent_id 与菜单严格一致） */
export type HomeNavCategoryGroup = {
  rootCategory: Category
  sectionCategories: Category[]
}

export function homeNavigationCategoryGroups(
  navigation: NavigationMenuTreeNode[],
  categories: Category[],
): HomeNavCategoryGroup[] {
  const slugToCat = new Map(categories.map((c) => [c.slug, c]))
  const sortedRoots = [...navigation].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const result: HomeNavCategoryGroup[] = []

  for (const node of sortedRoots) {
    if (node.children.length === 0) {
      const slug = slugFromCategoryMenuHref(node.href)
      if (!slug || slug === 'hot') continue
      const cat = slugToCat.get(slug)
      if (!cat || cat.slug === 'hot') continue
      result.push({
        rootCategory: cat,
        sectionCategories: [cat],
      })
      continue
    }

    const items = foldableCategoryItems(node, slugToCat, categories)
    const sectionCategories = items
      .map((it) => categories.find((c) => idsEqual(c.id, it.categoryId)))
      .filter(
        (entry): entry is Category =>
          entry != null && entry.slug !== 'hot',
      )

    if (sectionCategories.length === 0) continue

    let rootCategory =
      resolveFoldGroupParentCategory(node, slugToCat, categories) ??
      inferFoldParentCategoryFromChildren(node, slugToCat, categories)

    if (!rootCategory) {
      rootCategory = ascendCategoryToRoot(categories, sectionCategories[0])
    }

    result.push({
      rootCategory,
      sectionCategories,
    })
  }

  return result
}
