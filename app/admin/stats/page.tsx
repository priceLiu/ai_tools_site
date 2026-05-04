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

function hasParentId(c: Pick<Category, 'parent_id'>): boolean {
  const p = c.parent_id
  return p != null && String(p).trim() !== ''
}

/** 与首页/分类页列表一致：仅已通过且未禁用 */
function isPublicListedTool(t: {
  status?: string | null
  is_disabled?: boolean | null
}): boolean {
  return t.status === 'approved' && t.is_disabled !== true
}

/** 首页「热门工具」区块：已通过 + 未禁用 + 标记热门（见 lib/cached-home-data） */
function isHomeHotListedTool(t: {
  status?: string | null
  is_disabled?: boolean | null
  is_featured?: boolean | null
}): boolean {
  return isPublicListedTool(t) && t.is_featured === true
}

export default async function AdminStatsPage() {
  const [cats, toolRows] = await Promise.all([
    neon.neonListStatsCategories(),
    neon.neonListStatsTools(),
  ])

  const catById = new Map(cats.map((c) => [c.id, c]))

  function categoryBarLabel(c: Category): string {
    if (!hasParentId(c)) return c.name
    const p = c.parent_id ? catById.get(String(c.parent_id).trim()) : undefined
    return p ? `${p.name} · ${c.name}` : c.name
  }

  /** 按 category_id 汇总：前台可见工具数（普通分类页 /category/{slug} 用；不含 hot 的特殊逻辑） */
  const publicCountByCategoryId = new Map<string, number>()
  for (const t of toolRows) {
    if (!isPublicListedTool(t)) continue
    const cid = t.category_id
    if (cid == null || String(cid).trim() === '') continue
    const k = String(cid).trim()
    publicCountByCategoryId.set(k, (publicCountByCategoryId.get(k) ?? 0) + 1)
  }

  /** 柱状图：普通分类 = 该 category_id 下前台可见工具数；slug 为 hot 与 /category/hot 一致 = 全站标记热门（非按分类归属） */
  const featuredToolsCount = toolRows.filter((t) => isHomeHotListedTool(t))
    .length

  const categoryBars: AdminCategoryBarDatum[] = cats.map((c) => {
    const isHotNavCategory = c.slug === 'hot'
    const count = isHotNavCategory
      ? featuredToolsCount
      : publicCountByCategoryId.get(String(c.id).trim()) ?? 0
    return {
      id: c.id,
      label: categoryBarLabel(c),
      count,
    }
  })

  const parentCategoryCount = cats.filter((c) => !hasParentId(c)).length
  const totalTools = toolRows.length
  const publicListedCount = toolRows.filter((t) => isPublicListedTool(t))
    .length
  /** 已通过但被管理员隐藏（前台不展示）：与 /admin?tab=hidden 一致 */
  const hiddenApprovedCount = toolRows.filter(
    (t) => t.status === 'approved' && t.is_disabled === true,
  ).length
  const uncategorizedCount = toolRows.filter(
    (t) => t.category_id == null || String(t.category_id).trim() === '',
  ).length
  const uncategorizedPublicCount = toolRows.filter(
    (t) =>
      isPublicListedTool(t) &&
      (t.category_id == null || String(t.category_id).trim() === ''),
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
        publicListedCount={publicListedCount}
        hiddenApprovedCount={hiddenApprovedCount}
        featuredToolsCount={featuredToolsCount}
        uncategorizedCount={uncategorizedCount}
        uncategorizedPublicCount={uncategorizedPublicCount}
        categoryBars={categoryBars}
      />
    </div>
  )
}
