'use server'

import { revalidatePath } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { getAuthUser } from '@/lib/auth/session'

async function requireAdmin() {
  const user = await getAuthUser()
  if (!user) throw new Error('未登录')
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) throw new Error('无权限')
}

export async function adminApproveShowcaseAction(input: {
  profileId: string
  slug: string
}) {
  await requireAdmin()
  const r = await neon.neonAdminApproveShowcaseApplication({
    profileId: input.profileId,
    slug: input.slug.trim(),
  })
  if (r.error) throw new Error(r.error)
  revalidatePath('/admin/showcases')
  revalidatePath('/excellent-ai-solutions')
  if (r.slug) {
    revalidatePath(`/excellent-ai-solutions/${encodeURIComponent(r.slug)}`)
  }
}

export async function adminRejectShowcaseAction(input: {
  profileId: string
  reason: string
}) {
  await requireAdmin()
  const reason = input.reason.trim()
  if (reason.length < 2) throw new Error('驳回原因至少 2 个字')
  await neon.neonAdminRejectShowcaseApplication({
    profileId: input.profileId,
    reason,
  })
  revalidatePath('/admin/showcases')
}

export async function adminRevokeShowcaseAction(profileId: string) {
  await requireAdmin()
  await neon.neonAdminRevokeShowcasePublication(profileId)
  revalidatePath('/admin/showcases')
  revalidatePath('/excellent-ai-solutions')
}
