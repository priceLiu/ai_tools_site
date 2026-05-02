import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { AdminUsersTable } from '@/components/admin-users-table'
import type { Profile } from '@/lib/types'

export const metadata = {
  title: '用户管理 - 管理后台',
}

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, is_admin, is_disabled, created_at')
    .order('created_at', { ascending: false })

  const profiles = (rows ?? []) as Profile[]

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>

        <h1 className="mb-2 text-2xl font-bold text-foreground">用户管理</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          设置管理员（<code className="rounded bg-muted px-1">is_admin</code>
          ）与账号禁用。禁用后用户将被退出且无法继续使用站点功能。
        </p>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            加载用户列表失败：{error.message}
          </div>
        ) : (
          <AdminUsersTable
            profiles={profiles}
            currentUserId={user?.id ?? ''}
          />
        )}
      </div>
    </div>
  )
}
