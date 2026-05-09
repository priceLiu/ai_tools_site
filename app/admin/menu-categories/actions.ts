'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import {
  HOME_TOOL_BUNDLE_CACHE_TAG,
  NAVIGATION_MENU_CACHE_TAG,
  TAG_SUGGEST_DICTIONARY_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'
import { adminSetToolFeaturedAction } from '@/app/actions/database-mutations'

async function requireAdmin(): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) return { error: '无权限' }
  return null
}

function revalidateMenuCategorySurfaces() {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
  revalidateTag(TAG_SUGGEST_DICTIONARY_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/admin/menu-categories')
  revalidatePath('/category/[slug]', 'page')
}

export async function adminCreateMenuCategoryAction(input: {
  name: string
  parentId: string | null
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminInsertMenuCategory({
    name: input.name,
    parentId: input.parentId,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true, id: r.id }
}

export async function adminSetMenuCategoryDisabledAction(input: {
  categoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminSetCategoryDisabled({
    categoryId: input.categoryId,
    isDisabled: input.isDisabled,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

export async function adminLinkTagToMenuCategoryAction(input: {
  categoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminLinkTagToMenuCategory(input)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

export async function adminUnlinkTagFromMenuCategoryAction(input: {
  categoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminUnlinkTagFromMenuCategory(input)
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

export async function adminSearchToolsNotInMenuCategoryAction(input: {
  categoryId: string
  query: string
}): Promise<
  | { ok: true; tools: { id: string; name: string; slug: string }[] }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const cid = input.categoryId.trim()
  if (!cid) return { ok: false, error: '缺少分类' }

  try {
    const tools = await neon.neonAdminSearchToolsNotInMenuCategory({
      categoryId: cid,
      query: input.query,
    })
    return { ok: true, tools }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '查询失败',
    }
  }
}

export async function adminLinkToolToMenuCategoryAction(input: {
  categoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminLinkToolToMenuCategory({
    categoryId: input.categoryId.trim(),
    toolId: input.toolId.trim(),
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

export async function adminUnlinkToolFromMenuCategoryAction(input: {
  categoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminUnlinkToolFromMenuCategory({
    categoryId: input.categoryId.trim(),
    toolId: input.toolId.trim(),
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

async function assertHotCategoryId(categoryId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const slug = await neon.neonCategorySlugById(categoryId.trim())
  if (slug !== 'hot') {
    return { ok: false, error: '目标分类不是热门产品线（slug≠hot）' }
  }
  return { ok: true }
}

/** 加入首页热门：is_featured=true，并写入 hot 的 junction（与其它菜单一致）。 */
export async function adminAddToolToHotFeaturedAction(input: {
  hotCategoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const hotGuard = await assertHotCategoryId(input.hotCategoryId)
  if (!hotGuard.ok) return { ok: false, error: hotGuard.error }

  const tid = input.toolId.trim()
  const cid = input.hotCategoryId.trim()
  const featuredRes = await adminSetToolFeaturedAction(tid, true)
  if (featuredRes.error) return { ok: false, error: featuredRes.error }

  await neon.neonEnsureToolMenuCategoryLink(tid, cid)
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

/** 移出首页热门：is_featured=false，并删除 hot junction（若有）。 */
export async function adminRemoveToolFromHotFeaturedAction(input: {
  hotCategoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const hotGuard = await assertHotCategoryId(input.hotCategoryId)
  if (!hotGuard.ok) return { ok: false, error: hotGuard.error }

  const tid = input.toolId.trim()
  const cid = input.hotCategoryId.trim()
  const featuredRes = await adminSetToolFeaturedAction(tid, false)
  if (featuredRes.error) return { ok: false, error: featuredRes.error }

  await neon.neonAdminUnlinkToolFromMenuCategory({
    categoryId: cid,
    toolId: tid,
  })
  revalidateMenuCategorySurfaces()
  return { ok: true }
}

export async function adminSearchToolsForHotPickerAction(input: {
  query: string
}): Promise<
  | { ok: true; tools: { id: string; name: string; slug: string }[] }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  try {
    const tools = await neon.neonAdminSearchToolsForHotPicker({
      query: input.query,
    })
    return { ok: true, tools }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '查询失败',
    }
  }
}

export async function adminDeleteMenuCategoryAction(input: {
  categoryId: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminDeleteMenuCategory({
    categoryId: input.categoryId.trim(),
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateMenuCategorySurfaces()
  return { ok: true }
}
