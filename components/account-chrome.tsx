import { Header } from '@/components/header'
import { AccountNav } from '@/components/account-nav'
import type { Profile } from '@/lib/types'
import type { AuthUser } from '@/lib/auth/session'

interface AccountChromeProps {
  user: AuthUser
  profile: Profile | null
  children: React.ReactNode
}

/** 顶部栏 + 个人中心同款左侧导航（头像、邮箱、菜单、底部退出） */
export function AccountChrome({ user, profile, children }: AccountChromeProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header user={user} profile={profile} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AccountNav
          email={user.email}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
