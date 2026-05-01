import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { AccountNav } from '@/components/account-nav'
import type { Profile } from '@/lib/types'

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} profile={profile as Profile | null} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AccountNav
          email={user.email ?? ''}
          avatarUrl={(profile as Profile | null)?.avatar_url ?? null}
        />
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl px-4 py-6 md:max-w-4xl md:px-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
