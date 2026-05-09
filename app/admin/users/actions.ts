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

// 删除用户的功能已移除（曾经的级联删除导致历史数据丢失）：
// 管理员只能「禁用」用户。如有极端情况需要彻底清理，请走数据库 SQL Editor + 备份。

export async function adminSetPortalDisabledByAdminAction(
  profileUserId: string,
  portalDisabled: boolean,
) {
  await requireAdmin()
  await neon.neonAdminSetPortalDisabledByAdmin({
    profileId: profileUserId,
    disabled: portalDisabled,
  })
  revalidatePath('/admin/users')
  revalidatePath('/account/home')
  revalidatePath('/account/profile')
}
