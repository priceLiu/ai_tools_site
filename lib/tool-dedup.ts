import type { SupabaseClient } from '@supabase/supabase-js'

/** 与「介绍前 50 字」规则一致，用于名称 + 分类 + 介绍片段三重判重 */
export const TOOL_DEDUP_INTRO_PREVIEW_LENGTH = 50

/** 与写入 tools.name 时保持一致，便于按 name 等值缩小查询范围 */
export function toolNameDedupKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function toolIntroductionPreviewDedup(
  introduction: string | null | undefined,
): string {
  return (introduction ?? '').trim().slice(0, TOOL_DEDUP_INTRO_PREVIEW_LENGTH)
}

/**
 * 若存在另一条记录：名称、分类、介绍前 50 字均相同，则视为重复，返回该行 id。
 * 任一项不同则不算重复（可新增）。
 */
export async function findDuplicateToolId(
  supabase: SupabaseClient,
  params: {
    name: string
    introduction: string
    categoryId: string | null
    excludeToolId?: string | null
  },
): Promise<string | null> {
  const nameKey = toolNameDedupKey(params.name)
  const preview = toolIntroductionPreviewDedup(params.introduction)

  let q = supabase.from('tools').select('id,introduction').eq('name', nameKey)
  if (params.categoryId) {
    q = q.eq('category_id', params.categoryId)
  } else {
    q = q.is('category_id', null)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (params.excludeToolId && row.id === params.excludeToolId) continue
    if (toolIntroductionPreviewDedup(row.introduction as string | null) === preview) {
      return row.id
    }
  }
  return null
}

export const TOOL_DEDUP_REJECT_MESSAGE =
  '已存在相同工具（名称、介绍前50字、分类三者均一致），无法重复添加。'
