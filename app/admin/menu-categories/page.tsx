import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import { AdminMenuCategoryManager } from '@/components/admin-menu-category-manager'
import { AdminMenuStatsCards } from '@/components/admin-menu-stats-cards'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '菜单分类管理 - 管理后台',
}

export const dynamic = 'force-dynamic'

function canonCatId(id: string): string {
  return String(id).trim().toLowerCase()
}

export default async function AdminMenuCategoriesPage() {
  const [
    categories,
    links,
    memberships,
    tcAgg,
    toolCountsApprovedVisible,
    featuredPublicCount,
  ] = await Promise.all([
    neon.neonListCategoriesAll(),
    neon.neonListCategoryTagLinks(),
    neon.neonListAdminToolCategoryMembershipRows(),
    neon.neonGetAdminToolCategoryAggregateStats(),
    neon.neonListAdminToolCountsByCategory(),
    neon.neonCountFeaturedToolsPublicListed(),
  ])

  const hotCategory = categories.find((c) => (c.slug ?? '').trim() === 'hot')
  const featuredToolsForHotList = hotCategory
    ? await neon.neonListToolsFeaturedHome()
    : []
  const hotKey = hotCategory ? canonCatId(hotCategory.id) : null
  const membershipsForUi =
    hotKey != null
      ? [
          ...memberships.filter((m) => canonCatId(m.category_id) !== hotKey),
          ...featuredToolsForHotList.map((t) => ({
            category_id: hotCategory!.id,
            tool_id: t.id,
            name: t.name,
            slug: t.slug,
            status: t.status,
            is_disabled: Boolean(t.is_disabled),
            view_count: t.view_count,
          })),
        ]
      : memberships

  const catsEnabled = categories.filter((c) => !c.is_disabled).length
  const catsDisabled = categories.length - catsEnabled
  const distinctLinkedTags = new Set(links.map((l) => l.tag_id)).size

  const tabBadgeByCategoryId: Record<string, number> = {}
  for (const r of toolCountsApprovedVisible) {
    tabBadgeByCategoryId[canonCatId(r.category_id)] = r.n
  }
  for (const c of categories) {
    if ((c.slug ?? '').trim() === 'hot') {
      tabBadgeByCategoryId[canonCatId(c.id)] = featuredPublicCount
    }
  }

  let tabCountsSum = 0
  for (const c of categories) {
    const key = canonCatId(c.id)
    if ((c.slug ?? '').trim() === 'hot') {
      tabCountsSum += featuredPublicCount
    } else {
      tabCountsSum += tabBadgeByCategoryId[key] ?? 0
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回管理后台
            </Link>
          </Button>
          <h1 className="mt-1 text-2xl font-bold">菜单分类管理</h1>
          <p className="text-sm text-muted-foreground">
            维护左侧产品线（<code className="rounded bg-muted px-1">categories</code>
            ）与<strong>工具</strong>的多对多挂载：同一工具可同时出现在多个菜单分类下。
            <code className="rounded bg-muted px-1">tools.category_id</code>{' '}
            仍表示表单/卡片用的<strong>主分类</strong>，写入时会自动保证对应 junction 存在。
          </p>
        </div>
      </div>

      <AdminMenuStatsCards
        categoriesTotal={categories.length}
        categoriesEnabled={catsEnabled}
        categoriesDisabled={catsDisabled}
        membershipEdgesPublicListed={tcAgg.membershipEdgesPublicListed}
        membershipEdgesTotal={tcAgg.membershipEdgesTotal}
        distinctToolsPublicListed={tcAgg.distinctToolsPublicListed}
        distinctToolsTotal={tcAgg.distinctToolsTotal}
        categoryTagLinks={links.length}
        distinctLinkedTags={distinctLinkedTags}
      />

      <Card className="mb-6 mt-6">
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
          <CardDescription className="space-y-1 text-xs leading-relaxed">
            <p>
              · Tab 括号内数字为<strong>前台可见条数</strong>（已通过且未隐藏工具；分类本身亦未禁用）；各 Tab
              之和约为 {tabCountsSum}
              （同一工具挂多类会计多次）。
              <strong className="text-foreground"> slug 为 hot </strong>
              的条目按首页「热门工具」口径统计{' '}
              <code className="rounded bg-muted px-1">is_featured</code>
              ，与{' '}
              <code className="rounded bg-muted px-1">tool_categories</code>{' '}
              行数可能不一致。
            </p>
            <p>
              · 列表仍展示<strong>全部后台挂载</strong>
              （含隐藏或未通过），便于清理 junction；隐藏项会带标签提示。
            </p>
            <p>
              · 「禁用」后{' '}
              <code className="rounded bg-muted px-1">/category/[slug]</code>{' '}
              与侧栏指向该 slug 的入口隐藏；挂载关系保留，其它启用中的菜单仍可展示该工具。
            </p>
            <p>
              · 「仅从本条移除」只删除该{' '}
              <code className="rounded bg-muted px-1">(tool_id, category_id)</code>{' '}
              联结，不删工具、不影响其它菜单分类。
            </p>
            <p>
              · <code className="rounded bg-muted px-1">category_tags</code>{' '}
              仍为菜单↔标签的运营联结（与工具挂载无关）；标签新建与清洗请在「标签管理」等页面操作。
            </p>
            <p>
              · 侧栏<strong>菜单链接</strong>请在「菜单管理」维护。
            </p>
            <p>
              · 若列表报错且提到{' '}
              <code className="rounded bg-muted px-1">tool_categories</code>
              ，请执行迁移{' '}
              <code className="rounded bg-muted px-1">
                20260507160000_tool_categories.sql
              </code>
              。
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <AdminMenuCategoryManager
        categories={categories}
        memberships={membershipsForUi}
        tabBadgeByCategoryId={tabBadgeByCategoryId}
        featuredToolsPublicCount={featuredPublicCount}
      />
    </div>
  )
}
