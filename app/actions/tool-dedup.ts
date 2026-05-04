'use server'

import { getAuthUser } from '@/lib/auth/session'
import { neonFindDuplicateTool } from '@/lib/neon/data'
import {
  toolNameDedupKey,
  toolIntroductionPreviewDedup,
  TOOL_DEDUP_REJECT_MESSAGE,
} from '@/lib/tool-dedup'

/** 提交前查重（Neon 全表） */
export async function assertNoDuplicateToolForSubmitAction(input: {
  name: string
  introduction: string
  categoryId: string | null
  excludeToolId?: string | null
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getAuthUser()
  if (!user) return { ok: false, message: '未登录' }

  try {
    const dup = await neonFindDuplicateTool(
      toolNameDedupKey(input.name),
      input.categoryId,
      toolIntroductionPreviewDedup(input.introduction),
      input.excludeToolId ?? null,
    )
    if (dup) return { ok: false, message: TOOL_DEDUP_REJECT_MESSAGE }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '查重失败，请稍后重试',
    }
  }
}
