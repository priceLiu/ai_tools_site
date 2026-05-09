import type { ReactNode } from 'react'
import { Header } from '@/components/header'
import { CompactAppSidebar } from '@/components/compact-app-sidebar'
import { MobileAccountSheet } from '@/components/mobile-account-sheet'
import type { Profile } from '@/lib/types'
import type { AuthUser } from '@/lib/auth/session'

interface AccountChromeProps {
  user: AuthUser
  profile: Profile | null
  children: ReactNode
  /** 顶栏第二行（如同步服务端渲染的 `PublicRoleStrip`） */
  belowHeader?: ReactNode
}

/**
 * 个人中心通用骨架：
 * - PC（≥ md）左侧固定 `<CompactAppSidebar variant="default">`，主区 `md:pl-[208px]`；
 * - 移动端 sidebar 收起，header 左上角 `<MobileAccountSheet>` 汉堡抽屉调出；
 * - 顶部 `<Header>` 与首页一致（搜索框 / 头像 / 更多三点）。
 */
export function AccountChrome({
  user,
  profile,
  children,
  belowHeader,
}: AccountChromeProps) {
  const email = user.email
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <div className="min-h-screen bg-background">
      <CompactAppSidebar
        variant="default"
        email={email}
        avatarUrl={avatarUrl}
      />
      <div className="flex min-h-screen flex-col md:pl-[208px]">
        <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <Header
            user={user}
            profile={profile}
            mobileNav={
              <MobileAccountSheet
                variant="default"
                email={email}
                avatarUrl={avatarUrl}
              />
            }
          />
          {belowHeader}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
