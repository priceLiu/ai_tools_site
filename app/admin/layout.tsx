import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { CompactAppSidebar } from '@/components/compact-app-sidebar'
import { MobileAccountSheet } from '@/components/mobile-account-sheet'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import type { Profile } from '@/lib/types'
import { getSessionProfile } from '@/lib/server-profile'

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent('/admin')}`)
  }

  const profile = await getSessionProfile(user.id)

  if (!profile?.is_admin) {
    redirect('/')
  }

  const email = user.email
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <div className="min-h-screen bg-background">
      <CompactAppSidebar
        variant="admin"
        email={email}
        avatarUrl={avatarUrl}
      />
      <div className="flex min-h-screen flex-col md:pl-56">
        <Header
          user={user}
          profile={profile as Profile}
          mobileNav={
            <MobileAccountSheet
              variant="admin"
              email={email}
              avatarUrl={avatarUrl}
            />
          }
        />
        <div className="flex-1">{children}</div>
        <Toaster />
        <SonnerToaster
          position="top-center"
          richColors
          duration={2600}
          className="!top-[42%] !bottom-auto [&_[data-description]]:text-center"
        />
      </div>
    </div>
  )
}
