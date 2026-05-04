'use server'

import { getAuthUser } from '@/lib/auth/session'
import {
  neonGetCategoryNameById,
  neonGetProfileIsAdmin,
  neonListToolsIdIntroFormatCategoryName,
  neonSetToolTagsForTool,
} from '@/lib/neon/data'
import {
  buildSuggestedToolTagNames,
  TOOL_TAGS_MAX,
} from '@/lib/tool-tags-extract'
import type { IntroductionFormat } from '@/lib/introduction-format'

function normalizeTagNames(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const n = t.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!n) continue
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
    if (out.length >= TOOL_TAGS_MAX) break
  }
  return out
}

/**
 * 登录用户：根据分类 + 介绍生成标签建议（不入库）
 */
export async function suggestToolTagNamesAction(input: {
  introduction: string
  introductionFormat: IntroductionFormat
  categoryId: string | null
}): Promise<{ names: string[] } | { error: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  let categoryName: string | null = null
  if (input.categoryId?.trim()) {
    categoryName = await neonGetCategoryNameById(input.categoryId.trim())
  }

  const names = buildSuggestedToolTagNames({
    categoryName,
    introduction: input.introduction,
    introductionFormat: input.introductionFormat,
  })
  return { names: normalizeTagNames(names) }
}

/**
 * 写入工具标签（所有者或管理员）
 */
export async function setToolTagsAction(input: {
  toolId: string
  tagNames: string[]
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const names = normalizeTagNames(input.tagNames)
  const isAdmin = await neonGetProfileIsAdmin(user.id)
  return neonSetToolTagsForTool({
    actorUserId: user.id,
    actorIsAdmin: isAdmin,
    toolId: input.toolId,
    names,
  })
}

/** 管理员：为全部工具按当前规则重写标签 */
export async function bulkExtractToolTagsAdminAction(): Promise<{
  ok: boolean
  updated: number
  error?: string
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, updated: 0, error: '未登录' }

  const isAdmin = await neonGetProfileIsAdmin(user.id)
  if (!isAdmin) return { ok: false, updated: 0, error: '无权限' }

  const rows = await neonListToolsIdIntroFormatCategoryName()
  let updated = 0
  for (const row of rows) {
    const names = buildSuggestedToolTagNames({
      categoryName: row.category_name,
      introduction: row.introduction ?? '',
      introductionFormat: row.introduction_format as IntroductionFormat,
    })
    const res = await neonSetToolTagsForTool({
      actorUserId: user.id,
      actorIsAdmin: true,
      toolId: row.id,
      names: normalizeTagNames(names),
    })
    if (!res.error) updated += 1
  }
  return { ok: true, updated }
}
