import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import * as neon from '@/lib/neon/data'
import { AdminToolTaggingPanel } from '@/components/admin-tool-tagging-panel'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: '工具与标签 - 管理后台',
}

export const dynamic = 'force-dynamic'

export default async function AdminToolsTaggingPage() {
  const [tagCategories, roleCategories] = await Promise.all([
    neon.neonListTagCategoriesAll(),
    neon.neonListRoleCategoriesAll(),
  ])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/admin/stats">
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回工具统计
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">工具与标签</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        写入仍为{' '}
        <code className="rounded bg-muted px-1 text-xs">tool_tags</code>{' '}
        唯一边表；场景分类挂在{' '}
        <code className="rounded bg-muted px-1 text-xs">
          tags.tag_category_id
        </code>
        ，角色候选来自{' '}
        <code className="rounded bg-muted px-1 text-xs">
          role_category_tags
        </code>
        。
      </p>

      <div className="mt-8">
        <AdminToolTaggingPanel
          tagCategories={tagCategories}
          roleCategories={roleCategories}
        />
      </div>
    </div>
  )
}
