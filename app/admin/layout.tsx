import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { CompactAppSidebar } from '@/components/compact-app-sidebar'
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

  return (
    <div className="min-h-screen bg-background">
      <CompactAppSidebar variant="admin" />
      <div className="flex min-h-screen flex-col pl-52 md:pl-56">
        <Header user={user} profile={profile as Profile} />
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
