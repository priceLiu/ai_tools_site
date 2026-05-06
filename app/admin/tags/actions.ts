'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import {
  HOME_ADS_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

async function requireAdmin(): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) return { error: '无权限' }
  return null
}

function revalidateTagSurfaces() {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/admin/tags')
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
}

/**
 * 合并：source 上所有 tool_tags 转到 target；source.name 写入 target.aliases；删 source。
 */
export async function adminMergeTagsAction(input: {
  sourceTagId: string
  targetTagId: string
}): Promise<{ ok: boolean; error?: string; movedTools?: number }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminMergeTags(input)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateTagSurfaces()
  return { ok: true, movedTools: r.movedTools }
}

export async function adminRenameTagAction(input: {
  tagId: string
  newName: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminRenameTag(input)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateTagSurfaces()
  return { ok: true }
}

export async function adminDeleteTagAction(
  tagId: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminDeleteTag(tagId)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateTagSurfaces()
  return { ok: true }
}

export async function adminSetTagCuratedAction(input: {
  tagId: string
  isCurated: boolean
  tagCategoryId: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  await neon.neonAdminSetTagCurated(input)
  revalidateTagSurfaces()
  return { ok: true }
}
