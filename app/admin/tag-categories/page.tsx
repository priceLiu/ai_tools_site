import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import { AdminSceneCategoryManager } from '@/components/admin-scene-category-manager'
import { AdminTagCreateCard } from '@/components/admin-tag-create-card'
import { AdminTagStatsCards } from '@/components/admin-tag-stats-cards'
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
  title: '场景分类管理 - 管理后台',
}

export const dynamic = 'force-dynamic'

export default async function AdminTagCategoriesPage() {
  const [tagCategories, tags, listedBulk] = await Promise.all([
    neon.neonListTagCategoriesAll(),
    neon.neonAdminListTagsAll(),
    neon.neonCountPublicListedToolsByTagCategoriesBulk(),
  ])

  const publicListedToolsByTagCategoryId = Object.fromEntries(listedBulk)

  const totalCurated = tags.filter((t) => t.is_curated).length
  const totalUncurated = tags.length - totalCurated
  const curatedToolLinks = tags
    .filter((t) => t.is_curated)
    .reduce((s, t) => s + t.tool_count, 0)
  const uncuratedToolLinks = tags
    .filter((t) => !t.is_curated)
    .reduce((s, t) => s + t.tool_count, 0)

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
          <h1 className="mt-1 text-2xl font-bold">场景分类管理</h1>
          <p className="text-sm text-muted-foreground">
            管理「按场景找 AI」下的场景分类（原 tag_categories）：新建分类、禁用前台展示、挂载/移出标签；
            与本页统计及「新建标签」共同维护受控词表。
          </p>
        </div>
      </div>

      <AdminTagStatsCards
        totalTags={tags.length}
        curated={totalCurated}
        uncurated={totalUncurated}
        curatedToolLinks={curatedToolLinks}
        uncuratedToolLinks={uncuratedToolLinks}
        categoriesCount={tagCategories.length}
      />

      <Card className="mb-6 mt-6">
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
          <CardDescription className="space-y-1 text-xs leading-relaxed">
            <p>
              · 「场景分类」决定标签在运营上的归属与首页卡片区；禁用时该分类从首页与{' '}
              <code className="rounded bg-muted px-1">/tag-category/[slug]</code>{' '}
              隐去，标签数据不删，可再启用或迁出。
            </p>
            <p>
              · Tab 上<strong>加粗数字</strong>为与首页「按场景找 AI」一致的<strong>收录工具数</strong>；「· N词」为该场景下词条（标签行）总数。
            </p>
            <p>
              · 「将已有标签加入」会修改该标签的归属分类；「移出分类」仅清空归属，不删除标签与工具关联。
            </p>
            <p>
              · 清洗（合并 / 改名 / 删除）仍在「标签管理」页完成。
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <div className="mb-6">
        <AdminTagCreateCard variant="scene" tagCategories={tagCategories} />
      </div>

      <AdminSceneCategoryManager
        tagCategories={tagCategories}
        tags={tags}
        publicListedToolsByTagCategoryId={publicListedToolsByTagCategoryId}
      />
    </div>
  )
}
