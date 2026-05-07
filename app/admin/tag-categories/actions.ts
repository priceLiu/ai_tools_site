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
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
  revalidatePath('/admin/role-categories')
}

export async function adminCreateSceneCategoryAction(input: {
  name: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminInsertTagCategory({ name: input.name })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true, id: r.id }
}

export async function adminSetSceneCategoryDisabledAction(input: {
  tagCategoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminSetTagCategoryDisabled({
    tagCategoryId: input.tagCategoryId,
    isDisabled: input.isDisabled,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true }
}

export async function adminAssignTagToSceneCategoryAction(input: {
  tagId: string
  tagCategoryId: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminAssignTagToCategory({
    tagId: input.tagId,
    tagCategoryId: input.tagCategoryId,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  return { ok: true }
}
