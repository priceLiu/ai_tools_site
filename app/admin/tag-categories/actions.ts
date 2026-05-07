'use server'

import { revalidatePath, revalidateTag, refresh } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import type { AdminTagRow } from '@/lib/types'
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
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
  revalidatePath('/admin/role-categories')
  /** 推送客户端 Router Cache / RSC 载荷刷新，避免后台同一页「保存成功但列表仍是旧的」 */
  refresh()
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
}): Promise<
  | {
      ok: true
      tag: AdminTagRow
      publicListedToolsByTagCategoryId: Record<string, number>
    }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const r = await neon.neonAdminAssignTagToCategory({
    tagId: input.tagId,
    tagCategoryId: input.tagCategoryId,
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidateSurfaces()
  const bulkMap = await neon.neonCountPublicListedToolsByTagCategoriesBulk()
  const publicListedToolsByTagCategoryId = Object.fromEntries(bulkMap)
  return { ok: true, tag: r.tag, publicListedToolsByTagCategoryId }
}

/**
 * 批量将「已通过」工具挂载本场景（每个工具：tagIds 为空则并入本场景全部启用词条，逻辑同单条）。
 * 全程只在末尾调用一次 `revalidateSurfaces`，避免连续挂载时多次 `refresh()` 导致 Tab 收录数与数据库不一致。
 */
export async function adminAppendSceneTagsToListedToolsBatchAction(input: {
  tagCategoryId: string
  toolIds: string[]
  /** 仅追加指定词条 id；多数场景传 [] 表示按分类整批并入 */
  tagIds?: string[]
}): Promise<
  | { ok: true; publicListedToolsByTagCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const cid = (input.tagCategoryId ?? '').trim().toLowerCase()
  if (!UUID_RE.test(cid)) return { ok: false, error: '无效的场景 id' }

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

  const allowed = await neon.neonAdminListEnabledTagIdsInSceneCategory(cid)
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
  const bulkMap = await neon.neonCountPublicListedToolsByTagCategoriesBulk()
  return {
    ok: true,
    publicListedToolsByTagCategoryId: Object.fromEntries(bulkMap),
  }
}

/** 将「已通过」工具挂载本场景（tagIds 为空时写入本场景全部启用词条…）。委托批量接口（单次 refresh）。 */
export async function adminAppendSceneTagsToListedToolAction(input: {
  tagCategoryId: string
  toolId: string
  tagIds: string[]
}): Promise<
  | { ok: true; publicListedToolsByTagCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  return adminAppendSceneTagsToListedToolsBatchAction({
    tagCategoryId: input.tagCategoryId,
    toolIds: [input.toolId],
    tagIds: input.tagIds ?? [],
  })
}

/**
 * 批量从工具的 tool_tags 中摘掉「归属本场景」的词条（不改 tags 表）。
 */
export async function adminStripSceneTagsFromListedToolsBatchAction(input: {
  tagCategoryId: string
  toolIds: string[]
}): Promise<
  | { ok: true; publicListedToolsByTagCategoryId: Record<string, number> }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (gate) return { ok: false, error: gate.error }

  const cid = (input.tagCategoryId ?? '').trim().toLowerCase()
  if (!UUID_RE.test(cid)) return { ok: false, error: '无效的场景 id' }

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
    const r = await neon.neonAdminStripSceneTagsFromListedTool({
      toolId: tid,
      tagCategoryId: cid,
    })
    if (!r.ok) return { ok: false, error: r.error }
  }

  revalidateSurfaces()
  const bulkMap = await neon.neonCountPublicListedToolsByTagCategoriesBulk()
  return {
    ok: true,
    publicListedToolsByTagCategoryId: Object.fromEntries(bulkMap),
  }
}
