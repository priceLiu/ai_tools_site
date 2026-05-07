'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import type { Tool } from '@/lib/types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function canonId(id: string): string {
  return String(id ?? '').trim().toLowerCase()
}

export async function saveAccountFollowsAction(input: {
  tagCategoryIds: string[]
  roleCategoryIds: string[]
  /** 「关注的工具」有序列表（至多 20） */
  toolIds?: string[]
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  try {
    await neon.neonReplaceUserFollowTagCategories(
      user.id,
      input.tagCategoryIds,
    )
    await neon.neonReplaceUserFollowRoleCategories(
      user.id,
      input.roleCategoryIds,
    )
    const toolErr = await neon.neonReplaceUserFollowTools(
      user.id,
      input.toolIds ?? [],
    )
    if (toolErr.error) return { error: toolErr.error }

    revalidatePath('/account/follows')
    return {}
  } catch (e) {
    console.error('[saveAccountFollowsAction]', e)
    return { error: '保存失败，请稍后重试' }
  }
}

export async function searchToolsForFollowPickerAction(input: {
  query: string
}): Promise<{ tools?: Tool[]; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  try {
    const tools = await neon.neonAccountSearchListedToolsForFollows({
      query: input.query ?? '',
      limit: 28,
    })
    return { tools }
  } catch (e) {
    console.error('[searchToolsForFollowPickerAction]', e)
    return { error: '搜索失败，请稍后重试' }
  }
}

/** 仅当用户已关注且分类仍启用时返回工具列表（只读） */
export async function fetchFollowSceneToolsAction(
  categoryId: string,
): Promise<{ tools?: Tool[]; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const raw = canonId(categoryId)
  if (!UUID_RE.test(raw)) return { error: '参数无效' }

  const follows = await neon.neonListUserFollowTagCategoriesJoined(user.id)
  const mine = follows.find((x) => x.id.toLowerCase() === raw)
  if (!mine) return { error: '未关注该场景或订阅已失效' }
  if (mine.is_disabled) {
    return { error: '该平台分类已停用或隐藏，暂不可浏览工具列表' }
  }

  const tools = await neon.neonListToolsByTagCategoryId(raw)
  return { tools }
}

export async function fetchFollowRoleToolsAction(
  roleCategoryId: string,
): Promise<{ tools?: Tool[]; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const raw = canonId(roleCategoryId)
  if (!UUID_RE.test(raw)) return { error: '参数无效' }

  const follows = await neon.neonListUserFollowRoleCategoriesJoined(user.id)
  const mine = follows.find((x) => x.id.toLowerCase() === raw)
  if (!mine) return { error: '未关注该角色或订阅已失效' }
  if (mine.is_disabled) {
    return { error: '该平台分类已停用或隐藏，暂不可浏览工具列表' }
  }

  const tools = await neon.neonListToolsByRoleCategoryId(raw)
  return { tools }
}
