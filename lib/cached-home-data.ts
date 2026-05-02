import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { createPublicSupabase } from '@/lib/supabase/public'
import {
  ascendCategoryToRoot,
  idsEqual,
  leafCategoriesOnly,
  pickerRootCategories,
} from '@/lib/category-tree'
import { loadNavigationMenuTree } from '@/lib/navigation-menu'
import { homeNavigationCategoryGroups } from '@/lib/submit-category-choices'
import type { Category, Tool } from '@/lib/types'
import {
  HOME_TOOL_BUNDLE_CACHE_TAG,
  NAVIGATION_MENU_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

function toolsBucket(
  map: Map<string, Tool[]>,
  categoryId: string,
): Tool[] {
  const u = map.get(categoryId)
  if (u) return u
  for (const [k, v] of map.entries()) {
    if (idsEqual(k, categoryId)) return v
  }
  return []
}

export type HomeCategoryBlock = {
  root: Category
  sections: { category: Category; tools: Tool[] }[]
}

export type HomeToolBundle = {
  categories: Category[]
  featured: Tool[]
  latest: Tool[]
  homeCategoryBlocks: HomeCategoryBlock[]
}

/** 无导航或导航未解析出分组时，仅用 DB parent_id 建树（旧逻辑） */
function fallbackSectionPlanFromDb(categories: Category[]) {
  const nonHot = categories.filter((c) => c.slug !== 'hot')
  const leaves = leafCategoriesOnly(nonHot).sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )
  const byRoot = new Map<string, Category[]>()
  for (const leaf of leaves) {
    const root = ascendCategoryToRoot(categories, leaf)
    const list = byRoot.get(root.id) ?? []
    list.push(leaf)
    byRoot.set(root.id, list)
  }
  const order = pickerRootCategories(categories, null).map((r) => r.id)
  const plan: {
    rootCategory: Category
    sectionCategories: Category[]
  }[] = []
  const used = new Set<string>()

  for (const rid of order) {
    const secs = byRoot.get(rid)
    if (!secs?.length) continue
    const root = categories.find((c) => c.id === rid)
    if (!root) continue
    used.add(rid)
    plan.push({ rootCategory: root, sectionCategories: secs })
  }

  for (const rid of [...byRoot.keys()].filter((id) => !used.has(id))) {
    const secs = byRoot.get(rid)!
    const root = categories.find((c) => c.id === rid)
    if (root) plan.push({ rootCategory: root, sectionCategories: secs })
  }

  return plan
}

async function loadHomeToolBundle(): Promise<HomeToolBundle> {
  const supabase = createPublicSupabase()

  const [{ data: categoriesRows }, navigation] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    loadNavigationMenuTree(),
  ])

  const cats = (categoriesRows as Category[]) ?? []
  const nonHot = cats.filter((c) => c.slug !== 'hot')

  const navPlan = homeNavigationCategoryGroups(navigation, cats)
  let sectionPlan =
    navPlan.length > 0 ? navPlan : fallbackSectionPlanFromDb(cats)

  const covered = new Set(
    sectionPlan.flatMap((g) => g.sectionCategories.map((c) => c.id)),
  )

  if (navPlan.length > 0) {
    for (const leaf of leafCategoriesOnly(nonHot)) {
      if (covered.has(leaf.id)) continue
      covered.add(leaf.id) // reserve id even when merging into existing root
      const root = ascendCategoryToRoot(cats, leaf)
      const existing = sectionPlan.find((p) =>
        idsEqual(p.rootCategory.id, root.id),
      )
      if (existing) {
        if (
          !existing.sectionCategories.some((c) => idsEqual(c.id, leaf.id))
        ) {
          existing.sectionCategories.push(leaf)
          existing.sectionCategories.sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              a.name.localeCompare(b.name),
          )
        }
      } else {
        sectionPlan.push({
          rootCategory: root,
          sectionCategories: [leaf],
        })
      }
    }
  }

  const idsToFetch = new Set<string>()
  for (const g of sectionPlan) {
    for (const c of g.sectionCategories) idsToFetch.add(c.id)
    if (!g.sectionCategories.some((c) => idsEqual(c.id, g.rootCategory.id))) {
      idsToFetch.add(g.rootCategory.id)
    }
  }

  const idList = [...idsToFetch]

  const toolsQuery =
    idList.length > 0
      ? supabase
          .from('tools')
          .select('*, category:categories(*)')
          .eq('status', 'approved')
          .eq('is_disabled', false)
          .in('category_id', idList)
          .order('view_count', { ascending: false })
      : Promise.resolve({ data: [] as Tool[] | null })

  const [{ data: featuredTools }, { data: latestTools }, { data: sectionTools }] =
    await Promise.all([
      supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'approved')
        .eq('is_disabled', false)
        .eq('is_featured', true)
        .order('view_count', { ascending: false }),
      supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'approved')
        .eq('is_disabled', false)
        .order('created_at', { ascending: false }),
      toolsQuery,
    ])

  const toolsByCat = new Map<string, Tool[]>()
  for (const t of ((sectionTools as Tool[]) ?? []) as Tool[]) {
    const cid = t.category_id
    if (!cid) continue
    if (!toolsByCat.has(cid)) toolsByCat.set(cid, [])
    toolsByCat.get(cid)!.push(t)
  }

  const homeCategoryBlocks: HomeCategoryBlock[] = []
  for (const g of sectionPlan) {
    const sections: { category: Category; tools: Tool[] }[] = []
    const hasRootSection = g.sectionCategories.some((c) =>
      idsEqual(c.id, g.rootCategory.id),
    )
    const rootTools = toolsBucket(toolsByCat, g.rootCategory.id)
    if (!hasRootSection && rootTools.length > 0) {
      sections.push({ category: g.rootCategory, tools: rootTools })
    }
    for (const cat of g.sectionCategories) {
      sections.push({
        category: cat,
        tools: toolsBucket(toolsByCat, cat.id),
      })
    }
    sections.sort(
      (a, b) =>
        a.category.sort_order - b.category.sort_order ||
        a.category.name.localeCompare(b.category.name),
    )
    homeCategoryBlocks.push({ root: g.rootCategory, sections })
  }

  const featured = ((featuredTools as Tool[]) ?? []) as Tool[]
  const latest = ((latestTools as Tool[]) ?? []) as Tool[]

  return {
    categories: cats,
    featured,
    latest,
    homeCategoryBlocks,
  }
}

const getHomeToolBundleCached = unstable_cache(
  loadHomeToolBundle,
  ['home-tool-bundle-v1'],
  {
    tags: [HOME_TOOL_BUNDLE_CACHE_TAG, NAVIGATION_MENU_CACHE_TAG],
    revalidate: false,
  },
)

/**
 * 首页数据快照：默认走 Next Data Cache（等价于服务端持有 JSON），避免每次请求都打满查询。
 * — 菜单/分类变更：`revalidateTag(NAVIGATION_MENU_CACHE_TAG)` 会一并失效本缓存。
 * — 工具变更：`revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG)`（见 revalidateHomeToolBundleAction）。
 * 浏览器强刷新（no-cache）时与导航树一致，跳过缓存读出最新数据。
 */
export async function getHomeToolBundle(): Promise<HomeToolBundle> {
  const h = await headers()
  const cacheControl = h.get('cache-control')?.toLowerCase() ?? ''
  const pragma = h.get('pragma')?.toLowerCase() ?? ''
  const bypassCache =
    pragma.includes('no-cache') ||
    cacheControl.includes('no-cache') ||
    cacheControl.includes('max-age=0')

  if (bypassCache) {
    return loadHomeToolBundle()
  }
  return getHomeToolBundleCached()
}
