import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { createPublicSupabase } from '@/lib/supabase/public'
import type { Category, Tool } from '@/lib/types'

/** 与产品说明一致：首页工具列表 10 分钟内复用服务端缓存 */
export const HOME_TOOL_DATA_REVALIDATE_SECONDS = 600

export type HomeToolBundle = {
  categories: Category[]
  categoriesForSections: Category[]
  featured: Tool[]
  latest: Tool[]
  categoryTools: { category: Category; tools: Tool[] }[]
}

async function loadHomeToolBundle(): Promise<HomeToolBundle> {
  const supabase = createPublicSupabase()

  const { data: categoriesRows } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const cats = (categoriesRows as Category[]) ?? []
  const categoriesForSections = cats.filter((c) => c.slug !== 'hot')

  const categoryFetches = categoriesForSections.map((cat) =>
    supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'approved')
      .eq('category_id', cat.id)
      .order('view_count', { ascending: false }),
  )

  const [{ data: featuredTools }, { data: latestTools }, ...categoryResults] =
    await Promise.all([
      supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'approved')
        .eq('is_featured', true)
        .order('view_count', { ascending: false }),
      supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      ...categoryFetches,
    ])

  const categoryTools: { category: Category; tools: Tool[] }[] = []
  categoryResults.forEach((res, i) => {
    const cat = categoriesForSections[i]
    const tools = (res.data as Tool[]) || []
    if (tools.length > 0) {
      categoryTools.push({ category: cat, tools })
    }
  })

  const featured = ((featuredTools as Tool[]) ?? []) as Tool[]
  const latest = ((latestTools as Tool[]) ?? []) as Tool[]

  return {
    categories: cats,
    categoriesForSections,
    featured,
    latest,
    categoryTools,
  }
}

const getCachedHomeToolBundle = unstable_cache(
  loadHomeToolBundle,
  ['home-tool-bundle-v2'],
  {
    revalidate: HOME_TOOL_DATA_REVALIDATE_SECONDS,
  },
)

/**
 * 普通导航走 10 分钟 Data Cache；浏览器强刷常带 no-cache / max-age=0，此时绕过缓存拉最新数据。
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
  return getCachedHomeToolBundle()
}
