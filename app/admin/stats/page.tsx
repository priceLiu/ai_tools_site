import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import {
  AdminStatsPanel,
  type AdminCategoryBarDatum,
} from '@/components/admin-stats-panel'
import type { Category } from '@/lib/types'

export const metadata = {
  title: '统计模块 - 管理后台',
}

/** 管理统计依赖实时 DB；禁用静态/ISR 壳误显示旧聚合。 */
export const dynamic = 'force-dynamic'

function hasParentId(c: Pick<Category, 'parent_id'>): boolean {
  const p = c.parent_id
  return p != null && String(p).trim() !== ''
}

export default async function AdminStatsPage() {
  const [cats, counts, byCategory] = await Promise.all([
    neon.neonListStatsCategories(),
    neon.neonGetAdminStatsToolCounts(),
    neon.neonGetAdminStatsPublicToolCountsByCategory(),
  ])

  const catById = new Map(cats.map((c) => [c.id, c]))

  function categoryBarLabel(c: Category): string {
    if (!hasParentId(c)) return c.name
    const p = c.parent_id ? catById.get(String(c.parent_id).trim()) : undefined
    return p ? `${p.name} · ${c.name}` : c.name
  }

  const publicCountByCategoryId = new Map(
    byCategory.map((row) => [String(row.category_id).trim(), row.n]),
  )

  const categoryBars: AdminCategoryBarDatum[] = cats.map((c) => {
    const isHotNavCategory = c.slug === 'hot'
    const count = isHotNavCategory
      ? counts.featuredToolsCount
      : publicCountByCategoryId.get(String(c.id).trim()) ?? 0
    return {
      id: c.id,
      label: categoryBarLabel(c),
      count,
    }
  })

  const parentCategoryCount = cats.filter((c) => !hasParentId(c)).length

  return (
    <div className="p-4 md:p-6">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">统计模块</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            分类规模与工具分布概览（ECharts 柱状图）
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href="/admin/tools-tagging"
            className="text-sm font-medium text-primary hover:underline"
          >
            工具与标签
          </Link>
          <Link
            href="/admin"
            className="text-sm font-medium text-muted-foreground hover:text-primary hover:underline"
          >
            审核列表
          </Link>
        </div>
      </div>

      <AdminStatsPanel
        parentCategoryCount={parentCategoryCount}
        totalTools={counts.totalTools}
        publicListedCount={counts.publicListedCount}
        hiddenApprovedCount={counts.hiddenApprovedCount}
        featuredToolsCount={counts.featuredToolsCount}
        uncategorizedCount={counts.uncategorizedCount}
        uncategorizedPublicCount={counts.uncategorizedPublicCount}
        categoryBars={categoryBars}
      />
    </div>
  )
}
