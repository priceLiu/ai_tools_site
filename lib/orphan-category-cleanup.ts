import type { SupabaseClient } from '@supabase/supabase-js'
import { slugFromCategoryMenuHref } from '@/lib/submit-category-choices'

/** 删除父级菜单前收集子树内所有 href（级联删库后无法再读） */
export async function collectMenuSubtreeHrefsBeforeDelete(
  supabase: SupabaseClient,
  rootId: string,
): Promise<string[]> {
  const { data: rows } = await supabase
    .from('navigation_menu_items')
    .select('id, parent_id, href')
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
 * （此前只在同步菜单时「补缺插入」，从未在删菜单时删库，导致 categories 表残留。）
 */
export async function tryDeleteOrphanCategoryFromNavHref(
  supabase: SupabaseClient,
  navHref: string,
): Promise<void> {
  const slug = slugFromCategoryMenuHref(navHref.trim())
  if (!slug || slug === 'hot') return

  const { data: allNav } = await supabase
    .from('navigation_menu_items')
    .select('href')
  for (const r of allNav ?? []) {
    if (slugFromCategoryMenuHref((r.href ?? '').trim()) === slug) return
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (!cat?.id) return

  const { count: toolCount, error: toolErr } = await supabase
    .from('tools')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', cat.id)
  if (toolErr) return
  if ((toolCount ?? 0) > 0) return

  const { count: childCount, error: childErr } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', cat.id)
  if (childErr) return
  if ((childCount ?? 0) > 0) return

  await supabase.from('categories').delete().eq('id', cat.id)
}
