import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNavigationMenuTree } from '@/lib/navigation-menu'
import { AdminImportToolsForm } from '@/components/admin-import-tools-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Category } from '@/lib/types'

export const metadata = {
  title: '批量导入工具 - 管理后台',
}

export default async function AdminImportToolsPage() {
  const supabase = await createClient()
  const [{ data: rows }, navigation] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    getNavigationMenuTree(),
  ])

  const categories = (rows as Category[] | null) ?? []

  return (
    <main className="p-3 md:p-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              返回审核列表
            </Link>
          </Button>
        </div>
        <h1 className="text-xl font-bold text-foreground md:text-2xl">
          批量导入工具数据
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          用于从 <code className="rounded bg-muted px-1">docs/data.json</code>{' '}
          同类结构批量写入数据库。可<strong className="text-foreground">上传本地 JSON 文件</strong>
          或粘贴内容；图标链接会在服务端下载并转为 data URL（base64）后存入{' '}
          <code className="rounded bg-muted px-1">logo_url</code>。
        </p>

        <div className="mt-6">
          {categories.length === 0 ? (
            <p className="text-sm text-destructive">
              暂无分类，请先在数据库或菜单同步中配置分类。
            </p>
          ) : (
            <AdminImportToolsForm
              categories={categories}
              navigation={navigation}
            />
          )}
        </div>
      </div>
    </main>
  )
}
