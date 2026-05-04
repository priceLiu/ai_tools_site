import Link from 'next/link'
import { AdminNavigationMenuEditor } from '@/components/admin-navigation-menu-editor'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { NavigationMenuItemRow } from '@/lib/types'
import * as neon from '@/lib/neon/data'

export const metadata = {
  title: '菜单管理 - 管理后台',
}

export default async function AdminNavigationMenuPage() {
  const rows = await neon.neonListNavigationForAdmin()

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>

        <h1 className="mb-6 text-2xl font-bold text-foreground">首页侧栏菜单</h1>

        {!rows?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            尚未读取到菜单数据。请先在数据库执行迁移
            （<code className="rounded bg-muted px-1">
              supabase/migrations/20260502153000_navigation_menu_items.sql
            </code>
            ）。
          </div>
        ) : null}

        <AdminNavigationMenuEditor
          initialRows={(rows ?? []) as NavigationMenuItemRow[]}
        />
      </div>
    </div>
  )
}
