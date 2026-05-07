import type { Metadata } from 'next'
import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AccountChromeWithRoleStrip } from '@/components/account-chrome-with-role-strip'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  toolDetailPageGutterClass,
} from '@/lib/tool-detail-layout'
import { getSessionProfile } from '@/lib/server-profile'

/** 个人中心不进搜索引擎索引（与 robots.ts 双重保险）。 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const profile = await getSessionProfile(user.id)

  return (
    <AccountChromeWithRoleStrip user={user} profile={profile as Profile | null}>
      <div className={cn('w-full', toolDetailPageGutterClass)}>
        {children}
      </div>
    </AccountChromeWithRoleStrip>
  )
}
