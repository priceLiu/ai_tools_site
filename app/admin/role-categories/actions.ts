'use server'

import { revalidatePath, revalidateTag, refresh } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import {
  HOME_ADS_CACHE_TAG,
  HOME_ROLE_CATEGORIES_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
  TAG_SUGGEST_DICTIONARY_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  refresh()
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

/**
 * 批量将「已通过」工具挂载本品（每个工具 tagIds 为空则并入本品关联的全部启用词条）。
 * 仅在末尾 `revalidateSurfaces` 一次，避免连续挂载时 Tab 收录数不同步。
 */
export async function adminAppendRoleTagsToListedToolsBatchAction(input: {
  roleCategoryId: string
  toolIds: string[]
  tagIds?: string[]
}): Promise<
  | { ok: true; publicListedToolsByRoleCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const rid = (input.roleCategoryId ?? '').trim().toLowerCase()
  if (!UUID_RE.test(rid)) return { ok: false, error: '无效的角色分类 id' }

  const rawIds = input.toolIds ?? []
  const seen = new Set<string>()
  const toolIds: string[] = []
  for (const x of rawIds) {
    const tid = String(x).trim().toLowerCase()
    if (!UUID_RE.test(tid)) continue
    if (seen.has(tid)) continue
    seen.add(tid)
    toolIds.push(tid)
  }
  if (toolIds.length === 0) return { ok: false, error: '请选择至少一个工具' }

  const allowed = await neon.neonAdminListEnabledTagIdsLinkedToRoleCategory(rid)
  const tagIdsToAppend = input.tagIds ?? []

  for (const tid of toolIds) {
    const r = await neon.neonAdminAppendListedToolTags({
      toolId: tid,
      tagIdsToAppend,
      allowedTagIds: allowed,
    })
    if (!r.ok) return { ok: false, error: r.error }
  }

  revalidateSurfaces()
  const bulkMap = await neon.neonCountPublicListedToolsByRoleCategoriesBulk()
  return {
    ok: true,
    publicListedToolsByRoleCategoryId: Object.fromEntries(bulkMap),
  }
}

/** 将「已通过」工具挂载本品…。委托批量接口（单次 refresh）。 */
export async function adminAppendRoleTagsToListedToolAction(input: {
  roleCategoryId: string
  toolId: string
  tagIds: string[]
}): Promise<
  | { ok: true; publicListedToolsByRoleCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  return adminAppendRoleTagsToListedToolsBatchAction({
    roleCategoryId: input.roleCategoryId,
    toolIds: [input.toolId],
    tagIds: input.tagIds ?? [],
  })
}

/**
 * 批量从工具的 tool_tags 中摘掉「本品关联词条」（不改 role_category_tags / tags）。
 */
export async function adminStripRoleTagsFromListedToolsBatchAction(input: {
  roleCategoryId: string
  toolIds: string[]
}): Promise<
  | { ok: true; publicListedToolsByRoleCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const rid = (input.roleCategoryId ?? '').trim().toLowerCase()
  if (!UUID_RE.test(rid)) return { ok: false, error: '无效的角色分类 id' }

  const rawIds = input.toolIds ?? []
  const seen = new Set<string>()
  const toolIds: string[] = []
  for (const x of rawIds) {
    const tid = String(x).trim().toLowerCase()
    if (!UUID_RE.test(tid)) continue
    if (seen.has(tid)) continue
    seen.add(tid)
    toolIds.push(tid)
  }
  if (toolIds.length === 0) return { ok: false, error: '请选择至少一个工具' }

  for (const tid of toolIds) {
    const r = await neon.neonAdminStripRoleTagsFromListedTool({
      toolId: tid,
      roleCategoryId: rid,
    })
    if (!r.ok) return { ok: false, error: r.error }
  }

  revalidateSurfaces()
  const bulkMap = await neon.neonCountPublicListedToolsByRoleCategoriesBulk()
  return {
    ok: true,
    publicListedToolsByRoleCategoryId: Object.fromEntries(bulkMap),
  }
}
