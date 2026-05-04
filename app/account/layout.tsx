import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AccountChrome } from '@/components/account-chrome'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  toolDetailPageGutterClass,
} from '@/lib/tool-detail-layout'
import { getSessionProfile } from '@/lib/server-profile'

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const profile = await getSessionProfile(user.id)

  return (
    <AccountChrome user={user} profile={profile as Profile | null}>
      <div className={cn('w-full', toolDetailPageGutterClass)}>
        {children}
      </div>
    </AccountChrome>
  )
}
