'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import {
  HOME_ADS_CACHE_TAG,
  HOME_ROLE_CATEGORIES_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
  TAG_SUGGEST_DICTIONARY_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

async function requireAdmin(): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) return { error: '无权限' }
  return null
}

function revalidateSurfaces() {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_ROLE_CATEGORIES_CACHE_TAG, { expire: 0 })
  revalidateTag(TAG_SUGGEST_DICTIONARY_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/admin/tags')
  revalidatePath('/admin/tag-categories')
  revalidatePath('/admin/role-categories')
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
}

export async function adminCreateRoleCategoryAction(input: {
  name: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminInsertRoleCategory({ name: input.name })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true, id: r.id }
}

export async function adminSetRoleCategoryDisabledAction(input: {
  roleCategoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminSetRoleCategoryDisabled({
    roleCategoryId: input.roleCategoryId,
    isDisabled: input.isDisabled,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true }
}

export async function adminLinkTagToRoleCategoryAction(input: {
  roleCategoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminLinkTagToRoleCategory({
    roleCategoryId: input.roleCategoryId,
    tagId: input.tagId,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true }
}

export async function adminUnlinkTagFromRoleCategoryAction(input: {
  roleCategoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminUnlinkTagFromRoleCategory({
    roleCategoryId: input.roleCategoryId,
    tagId: input.tagId,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true }
}
