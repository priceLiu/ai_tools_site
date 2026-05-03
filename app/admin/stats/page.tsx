import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  AdminStatsPanel,
  type AdminCategoryBarDatum,
} from '@/components/admin-stats-panel'
import type { Category } from '@/lib/types'

export const metadata = {
  title: '统计模块 - 管理后台',
}

function hasParentId(c: Pick<Category, 'parent_id'>): boolean {
  const p = c.parent_id
  return p != null && String(p).trim() !== ''
}

export default async function AdminStatsPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: tools }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, parent_id, slug, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('tools').select('id, category_id, is_featured'),
  ])

  const cats = (categories ?? []) as Category[]
  const toolRows = tools ?? []

  const catById = new Map(cats.map((c) => [c.id, c]))

  function categoryBarLabel(c: Category): string {
    if (!hasParentId(c)) return c.name
    const p = c.parent_id ? catById.get(String(c.parent_id).trim()) : undefined
    return p ? `${p.name} · ${c.name}` : c.name
  }

  const countByCategoryId = new Map<string, number>()
  for (const t of toolRows) {
    const cid = t.category_id
    if (cid == null || String(cid).trim() === '') continue
    const k = String(cid).trim()
    countByCategoryId.set(k, (countByCategoryId.get(k) ?? 0) + 1)
  }

  const categoryBars: AdminCategoryBarDatum[] = cats.map((c) => ({
    id: c.id,
    label: categoryBarLabel(c),
    count: countByCategoryId.get(String(c.id).trim()) ?? 0,
  }))

  const parentCategoryCount = cats.filter((c) => !hasParentId(c)).length
  const totalTools = toolRows.length
  const featuredToolsCount = toolRows.filter((t) => t.is_featured === true)
    .length
  const uncategorizedCount = toolRows.filter(
    (t) => t.category_id == null || String(t.category_id).trim() === '',
  ).length

  return (
    <div className="p-4 md:p-6">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">统计模块</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            分类规模与工具分布概览（ECharts 柱状图）
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← 返回审核列表
        </Link>
      </div>

      <AdminStatsPanel
        parentCategoryCount={parentCategoryCount}
        totalTools={totalTools}
        featuredToolsCount={featuredToolsCount}
        uncategorizedCount={uncategorizedCount}
        categoryBars={categoryBars}
      />
    </div>
  )
}
