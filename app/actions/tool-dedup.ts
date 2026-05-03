'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  findDuplicateToolId,
  TOOL_DEDUP_REJECT_MESSAGE,
} from '@/lib/tool-dedup'

/** 提交前查重：优先用 service role 全表可见，否则回落为当前会话 RLS */
export async function assertNoDuplicateToolForSubmitAction(input: {
  name: string
  introduction: string
  categoryId: string | null
  excludeToolId?: string | null
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: '未登录' }

  const db = createServiceRoleClient() ?? supabase
  try {
    const dup = await findDuplicateToolId(db, {
      name: input.name,
      introduction: input.introduction,
      categoryId: input.categoryId,
      excludeToolId: input.excludeToolId ?? null,
    })
    if (dup) return { ok: false, message: TOOL_DEDUP_REJECT_MESSAGE }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '查重失败，请稍后重试',
    }
  }
}
