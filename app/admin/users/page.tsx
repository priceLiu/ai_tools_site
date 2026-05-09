import { getAuthUser } from '@/lib/auth/session'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { AdminUsersTable } from '@/components/admin-users-table'
import type { Profile } from '@/lib/types'
import * as neon from '@/lib/neon/data'

export const metadata = {
  title: '用户管理 - 管理后台',
}

export default async function AdminUsersPage() {
  const user = await getAuthUser()

  let profiles: Profile[] = []
  let loadError: string | null = null
  try {
    profiles = await neon.neonListProfilesForAdmin()
  } catch (e) {
    loadError = e instanceof Error ? e.message : '加载失败'
  }

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
          ）或禁用账号（须填写原因）。禁用后用户立即被踢出登录态、无法再登录；其提交的工具仍由系统保留，需单独到{' '}
          <code className="rounded bg-muted px-1">/admin?tab=hidden</code>{' '}
          管理。
          <br />
          <span className="text-xs">
            出于安全考虑，本页不提供「删除用户」功能；如确需彻底清理，请联系数据库管理员通过 SQL
            操作。尚未接入邮箱/短信找回时，可对
            <strong className="font-medium text-foreground">有本地登录记录</strong>
            的用户使用「重置密码」（无需旧密码）。
          </span>
        </p>

        {loadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            加载用户列表失败：{loadError}
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
