'use server'

import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  let categoryName: string | null = null
  if (input.categoryId?.trim()) {
    const { data: c } = await supabase
      .from('categories')
      .select('name')
      .eq('id', input.categoryId.trim())
      .maybeSingle()
    categoryName = c?.name ?? null
  }

  const names = buildSuggestedToolTagNames({
    categoryName,
    introduction: input.introduction,
    introductionFormat: input.introductionFormat,
  })
  return { names: normalizeTagNames(names) }
}

/**
 * 写入工具标签（所有者或管理员；内部 RPC 校验）
 */
export async function setToolTagsAction(input: {
  toolId: string
  tagNames: string[]
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const names = normalizeTagNames(input.tagNames)
  const { error } = await supabase.rpc('set_tool_tags_for_tool', {
    p_tool_id: input.toolId,
    p_names: names,
  })
  if (error) return { error: error.message }
  return {}
}

/** 管理员：为全部工具按当前规则重写标签 */
export async function bulkExtractToolTagsAdminAction(): Promise<{
  ok: boolean
  updated: number
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, updated: 0, error: '未登录' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { ok: false, updated: 0, error: '无权限' }

  const { data: rows, error: fetchErr } = await supabase
    .from('tools')
    .select('id, introduction, introduction_format, category:categories(name)')
  if (fetchErr) return { ok: false, updated: 0, error: fetchErr.message }

  let updated = 0
  for (const t of rows ?? []) {
    const row = t as unknown as {
      id: string
      introduction: string | null
      introduction_format?: string | null
      category: { name: string } | null
    }
    const names = buildSuggestedToolTagNames({
      categoryName: row.category?.name ?? null,
      introduction: row.introduction ?? '',
      introductionFormat: row.introduction_format as IntroductionFormat,
    })
    const { error } = await supabase.rpc('set_tool_tags_for_tool', {
      p_tool_id: row.id,
      p_names: normalizeTagNames(names),
    })
    if (!error) updated += 1
  }

  return { ok: true, updated }
}
