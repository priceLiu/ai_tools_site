import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { accountRootHref } from '@/lib/account-portal-policy'

export default async function AccountIndexPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/auth/login?redirect=/account')
  }
  const profile = await neon.neonGetProfileById(user.id)
  redirect(accountRootHref(profile))
}
