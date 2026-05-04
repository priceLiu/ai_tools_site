import { getAuthUser } from '@/lib/auth/session'
import { AccountProfileForm } from '@/components/account-profile-form'
import { AccountChangePasswordCard } from '@/components/account-change-password-card'
import { AccountAvatarEditor } from '@/components/account-avatar-editor'
import type { Profile } from '@/lib/types'
import { getSessionProfile } from '@/lib/server-profile'

export const metadata = {
  title: '个人信息 - 个人中心',
}

export default async function AccountProfilePage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getSessionProfile(user.id)

  const p = profile as Profile | null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">个人信息</h1>
        <p className="mt-1 text-muted-foreground">管理在当前站点展示的账号信息</p>
      </div>

      <AccountAvatarEditor profile={p} />

      <AccountProfileForm profile={p} email={user.email ?? null} />

      <AccountChangePasswordCard />
    </div>
  )
}
