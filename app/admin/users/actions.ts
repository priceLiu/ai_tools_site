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
  /** 禁用时必填，至少 2 字 */
  reason?: string,
) {
  const { user } = await requireAdmin()
  if (profileUserId === user.id && isDisabled) {
    throw new Error('不能禁用当前登录账号，请先由其他管理员操作')
  }
  if (isDisabled) {
    const r = reason?.trim() ?? ''
    if (r.length < 2) {
      throw new Error('请填写至少 2 个字的禁用原因')
    }
    await neon.neonUpdateProfileAdminFlags({
      id: profileUserId,
      is_disabled: true,
      disabled_reason: r,
    })
  } else {
    await neon.neonUpdateProfileAdminFlags({
      id: profileUserId,
      is_disabled: false,
      disabled_reason: null,
    })
  }
  revalidatePath('/admin/users')
}

export async function adminDeleteUserAction(profileUserId: string) {
  const { user } = await requireAdmin()
  if (profileUserId === user.id) {
    throw new Error('不能删除当前登录账号')
  }
  const target = await neon.neonGetProfileById(profileUserId)
  if (!target) throw new Error('用户不存在')

  if (target.is_admin) {
    const n = await neon.neonCountProfilesAdmins()
    if (n <= 1) {
      throw new Error('至少需要保留一名管理员，无法删除该账号')
    }
  }

  await neon.neonAdminDeleteUser(profileUserId)
  revalidatePath('/admin/users')
}
