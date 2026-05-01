import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { AccountProfileForm } from '@/components/account-profile-form'
import type { Profile } from '@/lib/types'

export const metadata = {
  title: '个人信息 - 个人中心',
}

export default async function AccountProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const p = profile as Profile | null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">个人信息</h1>
        <p className="mt-1 text-muted-foreground">管理在当前站点展示的账号信息</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border bg-muted">
          {p?.avatar_url ? (
            <Image src={p.avatar_url} alt="" fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              头像
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          头像由登录账号关联，暂在此仅展示。
        </p>
      </div>

      <AccountProfileForm profile={p} email={user.email ?? null} />
    </div>
  )
}
