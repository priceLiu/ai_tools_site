import type { ReactNode } from 'react'
import { getHomeRoleStrip } from '@/lib/cached-home-role-strip'
import { AccountChrome } from '@/components/account-chrome'
import { PublicRoleStrip } from '@/components/public-role-strip'
import type { Profile } from '@/lib/types'
import type { AuthUser } from '@/lib/auth/session'

export async function AccountChromeWithRoleStrip({
  user,
  profile,
  children,
}: {
  user: AuthUser
  profile: Profile | null
  children: ReactNode
}) {
  const roles = await getHomeRoleStrip()
  return (
    <AccountChrome
      user={user}
      profile={profile}
      belowHeader={<PublicRoleStrip roles={roles} />}
    >
      {children}
    </AccountChrome>
  )
}
