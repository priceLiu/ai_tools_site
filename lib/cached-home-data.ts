import { createPublicSupabase } from '@/lib/supabase/public'
import {
  ascendCategoryToRoot,
  idsEqual,
  leafCategoriesOnly,
  pickerRootCategories,
} from '@/lib/category-tree'
import { loadNavigationMenuTree } from '@/lib/navigation-menu'
import {
  homeNavigationCategoryGroups,
  type HomeNavCategoryGroup,
} from '@/lib/submit-category-choices'
import { fetchHomeToolBundleFromSnapshot } from '@/lib/home-bundle-snapshot'
import type { Category, HomeListedTool, Tool } from '@/lib/types'
import type { HomeCategoryBlock, HomeToolBundle } from '@/lib/home-tool-bundle-types'

export type { HomeCategoryBlock, HomeToolBundle } from '@/lib/home-tool-bundle-types'

function toolsBucket(
  map: Map<string, HomeListedTool[]>,
  categoryId: string,
): HomeListedTool[] {
  const u = map.get(categoryId)
  if (u) return u
  for (const [k, v] of map.entries()) {
    if (idsEqual(k, categoryId)) return v
  }
  return []
}

/** 首页「最新收录」展示条数（与查询 limit 一致） */
const HOME_LATEST_MAX = 15

function capHomeLatestBundle(bundle: HomeToolBundle): HomeToolBundle {
  if (bundle.latest.length <= HOME_LATEST_MAX) return bundle
  return { ...bundle, latest: bundle.latest.slice(0, HOME_LATEST_MAX) }
}

/** 与分类页一致的关联查询；再在内存中映射为 {@link HomeListedTool}（省略 introduction 等，但 logo 仍可能为体积较大的 data URL） */
const TOOLS_QUERY_WITH_CATEGORY = '*, category:categories(*)' as const

function toHomeListedTool(row: Tool): HomeListedTool {
  const cat = row.category
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logo_url: row.logo_url,
    category_id: row.category_id,
    view_count: row.view_count,
    favorite_count: row.favorite_count,
    is_featured: row.is_featured,
    status: row.status,
    is_disabled: row.is_disabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: cat
      ? {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          sort_order: cat.sort_order,
          parent_id: cat.parent_id ?? null,
          created_at: cat.created_at,
        }
      : undefined,
  }
}

function mapToolsToListed(rows: Tool[] | null | undefined): HomeListedTool[] {
  if (!rows?.length) return []
  return rows.map(toHomeListedTool)
}

function toolsByCategoryMapFromBundle(bundle: HomeToolBundle): Map<
  string,
  HomeListedTool[]
> {
  const m = new Map<string, HomeListedTool[]>()
  const add = (tools: HomeListedTool[]) => {
    for (const t of tools) {
      const cid = t.category_id
      if (!cid) continue
      const arr = m.get(cid)
      if (arr) {
        if (!arr.some((x) => x.id === t.id)) arr.push(t)
      } else {
        m.set(cid, [t])
      }
    }
  }
  for (const block of bundle.homeCategoryBlocks) {
    for (const s of block.sections) add(s.tools)
  }
  add(bundle.featured)
  add(bundle.latest)
  return m
}

function buildHomeCategoryBlocksFromNavPlan(
  sectionPlan: HomeNavCategoryGroup[],
  toolsByCat: Map<string, HomeListedTool[]>,
): HomeCategoryBlock[] {
  const homeCategoryBlocks: HomeCategoryBlock[] = []
  for (const g of sectionPlan) {
    const sections: { category: Category; tools: HomeListedTool[] }[] = []
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
  return homeCategoryBlocks
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

export async function loadHomeToolBundle(): Promise<HomeToolBundle> {
  const supabase = createPublicSupabase()

  const [{ data: categoriesRows }, navigation] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    loadNavigationMenuTree(),
  ])

  const cats = (categoriesRows as Category[]) ?? []

  const navPlan = homeNavigationCategoryGroups(navigation, cats)
  const sectionPlan =
    navPlan.length > 0 ? navPlan : fallbackSectionPlanFromDb(cats)

  /**
   * 有侧栏菜单时，首页版块**只**来自菜单解析结果，不再把「库里存在但未出现在菜单中的叶子分类」合并进来。
   * 否则用户删掉菜单项后，只要 categories 里还留着该行，首页会一直出现空版块（例如 image2）。
   * 无菜单时仍用 fallbackSectionPlanFromDb 按 parent_id 展示全部分类树。
   */

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
          .select(TOOLS_QUERY_WITH_CATEGORY)
          .eq('status', 'approved')
          .eq('is_disabled', false)
          .in('category_id', idList)
          .order('view_count', { ascending: false })
      : Promise.resolve({ data: [] as Tool[] | null })

  const [{ data: featuredTools }, { data: latestTools }, { data: sectionTools }] =
    await Promise.all([
      supabase
        .from('tools')
        .select(TOOLS_QUERY_WITH_CATEGORY)
        .eq('status', 'approved')
        .eq('is_disabled', false)
        .eq('is_featured', true)
        .order('view_count', { ascending: false }),
      supabase
        .from('tools')
        .select(TOOLS_QUERY_WITH_CATEGORY)
        .eq('status', 'approved')
        .eq('is_disabled', false)
        .order('created_at', { ascending: false })
        .limit(HOME_LATEST_MAX),
      toolsQuery,
    ])

  const sectionListed = mapToolsToListed(sectionTools as Tool[] | undefined)

  const toolsByCat = new Map<string, HomeListedTool[]>()
  for (const t of sectionListed) {
    const cid = t.category_id
    if (!cid) continue
    if (!toolsByCat.has(cid)) toolsByCat.set(cid, [])
    toolsByCat.get(cid)!.push(t)
  }

  const homeCategoryBlocks = buildHomeCategoryBlocksFromNavPlan(
    sectionPlan,
    toolsByCat,
  )

  const featured = mapToolsToListed(featuredTools as Tool[] | undefined)
  const latest = mapToolsToListed(latestTools as Tool[] | undefined)

  return {
    categories: cats,
    featured,
    latest,
    homeCategoryBlocks,
  }
}

/** 快照可能比数据库旧（删分类后未点「刷新首页缓存」）；用当前 categories 表去掉幽灵版块与无效关联 */
function pruneStaleCategoriesFromHomeBundle(
  bundle: HomeToolBundle,
  currentCategories: Category[],
): HomeToolBundle {
  const validIds = new Set(currentCategories.map((c) => c.id))

  const homeCategoryBlocks: HomeCategoryBlock[] = []
  for (const block of bundle.homeCategoryBlocks) {
    const sections = block.sections.filter((s) => validIds.has(s.category.id))
    if (sections.length === 0) continue

    let root = block.root
    if (!validIds.has(root.id)) {
      root = ascendCategoryToRoot(currentCategories, sections[0].category)
    }

    sections.sort(
      (a, b) =>
        a.category.sort_order - b.category.sort_order ||
        a.category.name.localeCompare(b.category.name),
    )
    homeCategoryBlocks.push({ root, sections })
  }

  const pruneListedTool = (t: HomeListedTool): HomeListedTool => {
    if (t.category_id && !validIds.has(t.category_id)) {
      return { ...t, category_id: null, category: undefined }
    }
    if (t.category && !validIds.has(t.category.id)) {
      return { ...t, category: undefined }
    }
    return t
  }

  return {
    categories: currentCategories,
    featured: bundle.featured.map(pruneListedTool),
    latest: bundle.latest.map(pruneListedTool),
    homeCategoryBlocks,
  }
}

/**
 * 首页 bundle：优先读 Supabase Storage 中的 JSON 快照（适合 Vercel，不受 Next 2MB Data Cache 限制）。
 * 快照需在变更后由 `revalidateHomeToolBundleAction` 写入；无文件或 `HOME_BUNDLE_SNAPSHOT_DISABLE=1` 时回退 `loadHomeToolBundle()`。
 * 读快照时会拉齐 categories + 侧栏菜单：已删库分类会摘掉；**只要配了菜单，分类版块结构以当前菜单为准**（工具卡片仍来自快照里的列表数据，减少大表查询）。
 */
export async function getHomeToolBundle(): Promise<HomeToolBundle> {
  const supabase = createPublicSupabase()
  const snap = await fetchHomeToolBundleFromSnapshot()

  if (snap) {
    const [{ data: categoriesRows }, navigation] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      loadNavigationMenuTree(),
    ])
    const currentCats = (categoriesRows as Category[]) ?? []
    const pruned = pruneStaleCategoriesFromHomeBundle(snap, currentCats)
    const navPlan = homeNavigationCategoryGroups(navigation, currentCats)
    if (navPlan.length > 0) {
      const toolsByCat = toolsByCategoryMapFromBundle(pruned)
      const homeCategoryBlocks = buildHomeCategoryBlocksFromNavPlan(
        navPlan,
        toolsByCat,
      )
      return capHomeLatestBundle({ ...pruned, homeCategoryBlocks })
    }
    return capHomeLatestBundle(pruned)
  }

  return capHomeLatestBundle(await loadHomeToolBundle())
}
