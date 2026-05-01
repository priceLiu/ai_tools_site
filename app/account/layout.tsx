import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountChrome } from '@/components/account-chrome'
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
    <AccountChrome user={user} profile={profile as Profile | null}>
      <div className="mx-auto max-w-3xl px-4 py-6 md:max-w-4xl md:px-8">
        {children}
      </div>
    </AccountChrome>
  )
}
