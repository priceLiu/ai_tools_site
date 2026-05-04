'use server'

import { revalidatePath } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { getAuthUser } from '@/lib/auth/session'

async function requireAdmin() {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('未登录')
  }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) throw new Error('无权限')
  return { user }
}

export async function adminSetProfileAdminAction(
  profileUserId: string,
  isAdmin: boolean,
) {
  await requireAdmin()
  await neon.neonUpdateProfileAdminFlags({
    id: profileUserId,
    is_admin: isAdmin,
  })
  revalidatePath('/admin/users')
}

export async function adminSetProfileDisabledAction(
  profileUserId: string,
  isDisabled: boolean,
) {
  const { user } = await requireAdmin()
  if (profileUserId === user.id && isDisabled) {
    throw new Error('不能禁用当前登录账号，请先由其他管理员操作')
  }
  await neon.neonUpdateProfileAdminFlags({
    id: profileUserId,
    is_disabled: isDisabled,
  })
  revalidatePath('/admin/users')
}
