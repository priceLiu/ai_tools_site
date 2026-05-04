'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import {
  neonFindAuthCredentialsByUserId,
  neonUpdateAuthCredentialsPasswordHash,
} from '@/lib/auth/credentials-db'
import { verifyStoredPasswordHash } from '@/lib/auth/verify-stored-password'
import { getAuthUser } from '@/lib/auth/session'

export async function changeOwnPasswordAction(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const current = input.currentPassword ?? ''
  const next = input.newPassword ?? ''
  if (!current || !next) return { error: '请填写完整' }
  if (next.length < 6) return { error: '新密码至少 6 位' }
  if (next === current) return { error: '新密码不能与当前密码相同' }

  const row = await neonFindAuthCredentialsByUserId(user.id)
  if (!row) {
    return { error: '当前账号无本地密码（可能为迁入用户），无法在此修改' }
  }

  const ok = await verifyStoredPasswordHash(current, row.password_hash)
  if (!ok) return { error: '当前密码不正确' }

  const hash = bcrypt.hashSync(next, 10)
  await neonUpdateAuthCredentialsPasswordHash(user.id, hash)
  revalidatePath('/account/profile')
  return {}
}
