import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import { AdminTagsManager } from '@/components/admin-tags-manager'
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
  title: '标签管理 - 管理后台',
}

export const dynamic = 'force-dynamic'

export default async function AdminTagsPage() {
  const [tagCategories, tags] = await Promise.all([
    neon.neonListTagCategoriesAll(),
    neon.neonAdminListTagsAll(),
  ])

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
          <h1 className="mt-1 text-2xl font-bold">标签管理</h1>
          <p className="text-sm text-muted-foreground">
            Curated / 待清理标签的查找、合并、改名、删除与 Curated 状态维护。场景分类挂载、前台禁用与统计请到「场景分类管理」。
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
          <CardDescription className="space-y-1 text-xs leading-relaxed">
            <p>
              · 新建标签与场景分类编排见{' '}
              <Link href="/admin/tag-categories" className="underline">
                场景分类管理
              </Link>
              。
            </p>
            <p>
              · 「合并」会把源标签上的所有工具迁到目标，并把源标签名加入目标的 aliases，最后删除源标签；不可逆。
            </p>
            <p>
              · 「删除」要求该标签下工具数为 0；如有工具，请先合并到 curated 标签上。
            </p>
            <p>
              · 任意写标签操作后会自动失效首页 / 分类详情 /{' '}
              <code>/tag-category/[slug]</code> / <code>/tag/[slug]</code> /{' '}
              <code>/role/[slug]</code> 的 ISR。
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <AdminTagsManager tagCategories={tagCategories} tags={tags} />
    </div>
  )
}
