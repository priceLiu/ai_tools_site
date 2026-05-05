'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { toolPublicPath } from '@/lib/tool-public-path'
import type { Profile } from '@/lib/types'

async function requireAdmin(): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) return { error: '无权限' }
  return null
}

export async function adminSetCommentHiddenAction(input: {
  commentId: string
  hidden: boolean
  toolSlug: string
}): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { error: gate.error }

  const ok = await neon.neonAdminSetCommentHidden(input.commentId, input.hidden)
  if (!ok) return { error: '评论不存在或更新失败' }

  const slug = input.toolSlug.trim()
  if (slug) {
    revalidatePath(toolPublicPath(slug))
  }
  revalidatePath('/admin/comments')
  return {}
}

export async function adminSetProfileCommentMuteAction(input: {
  profileId: string
  muted: boolean
  reason?: string | null
}): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { error: gate.error }

  await neon.neonAdminSetProfileCommentMute({
    profileId: input.profileId,
    muted: input.muted,
    reason: input.reason ?? null,
  })
  revalidatePath('/admin/comments')
  return {}
}

/** 禁言检索：至少 2 个字符（见 Neon 查询） */
export async function adminSearchProfilesForMuteAction(
  q: string,
): Promise<{ profiles: Profile[] } | { error: string }> {
  const gate = await requireAdmin()
  if (gate) return { error: gate.error }
  const profiles = await neon.neonAdminSearchProfilesForCommentMute(q, 40)
  return { profiles }
}
