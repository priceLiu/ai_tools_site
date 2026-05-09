'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import {
  HOME_ADS_CACHE_TAG,
  HOME_ROLE_CATEGORIES_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
  NAVIGATION_MENU_CACHE_TAG,
  TAG_SUGGEST_DICTIONARY_CACHE_TAG,
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
  revalidateTag(HOME_ROLE_CATEGORIES_CACHE_TAG, { expire: 0 })
  revalidateTag(TAG_SUGGEST_DICTIONARY_CACHE_TAG, { expire: 0 })
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/admin/tags')
  revalidatePath('/admin/tag-categories')
  revalidatePath('/admin/role-categories')
  revalidatePath('/admin/menu-categories')
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
  revalidatePath('/category/[slug]', 'page')
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

  const cid = input.tagCategoryId?.trim() ?? ''
  if (input.isCurated && !cid) {
    return {
      ok: false,
      error:
        'Curated 标签必须归属某个场景分类。请先在「场景分类」下拉中选择归属，再标 Curated。',
    }
  }

  await neon.neonAdminSetTagCurated(input)
  revalidateTagSurfaces()
  return { ok: true }
}

export async function adminSetTagDisabledAction(input: {
  tagId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminSetTagDisabled(input)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateTagSurfaces()
  return { ok: true }
}

export type AdminCreateTagActionInput =
  | {
      kind: 'scene'
      name: string
      tagCategoryId: string
      isCurated: boolean
    }
  | {
      kind: 'role'
      name: string
      roleCategoryId: string
      isCurated: boolean
    }
  | {
      kind: 'menu'
      name: string
      menuCategoryId: string
      isCurated: boolean
    }

/**
 * 新建标签：
 * - scene：写入 `tags.tag_category_id`（场景分类管理）
 * - role / menu：`tag_category_id` 置空，并写入 `role_category_tags` / `category_tags` 弱联结
 */
export async function adminCreateTagAction(
  input: AdminCreateTagActionInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  if (input.kind === 'scene') {
    const tid = input.tagCategoryId.trim()
    if (!tid) return { ok: false, error: '请选择场景分类' }
    const r = await neon.neonAdminInsertTag({
      name: input.name,
      tagCategoryId: tid,
      isCurated: input.isCurated,
    })
    if (!r.ok) return { ok: false, error: r.error }
    revalidateTagSurfaces()
    return { ok: true, id: r.id }
  }

  if (input.kind === 'role') {
    const rid = input.roleCategoryId.trim()
    if (!rid) return { ok: false, error: '请选择角色分类' }
    if (input.isCurated) {
      return {
        ok: false,
        error:
          '此处新建不会写入场景归属（tags.tag_category_id）。请先取消「标为 curated」，创建后到「标签清理」选择场景分类后再标 Curated。',
      }
    }
    const r = await neon.neonAdminInsertTag({
      name: input.name,
      tagCategoryId: null,
      isCurated: false,
    })
    if (!r.ok) return { ok: false, error: r.error }
    const link = await neon.neonAdminLinkTagToRoleCategory({
      roleCategoryId: rid,
      tagId: r.id,
    })
    if (!link.ok) {
      await neon.neonAdminDeleteTag(r.id)
      return { ok: false, error: link.error }
    }
    revalidateTagSurfaces()
    return { ok: true, id: r.id }
  }

  const mid = input.menuCategoryId.trim()
  if (!mid) return { ok: false, error: '请选择菜单分类' }
  if (input.isCurated) {
    return {
      ok: false,
      error:
        '此处新建不会写入场景归属（tags.tag_category_id）。请先取消「标为 curated」，创建后到「标签清理」选择场景分类后再标 Curated。',
    }
  }
  const r = await neon.neonAdminInsertTag({
    name: input.name,
    tagCategoryId: null,
    isCurated: false,
  })
  if (!r.ok) return { ok: false, error: r.error }
  const link = await neon.neonAdminLinkTagToMenuCategory({
    categoryId: mid,
    tagId: r.id,
  })
  if (!link.ok) {
    await neon.neonAdminDeleteTag(r.id)
    return { ok: false, error: link.error }
  }
  revalidateTagSurfaces()
  return { ok: true, id: r.id }
}
