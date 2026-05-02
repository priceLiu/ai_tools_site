import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { HOME_TOOL_BUNDLE_CACHE_TAG } from '@/lib/navigation-menu-cache-config'
import { createPublicSupabase } from '@/lib/supabase/public'

export const dynamic = 'force-dynamic'

/**
 * 记录一次「点击进入」产生的访问（由前端在卡片/列表链接 click 时调用）。
 * 计数依赖数据库 RPC increment_tool_view_count。
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) {
    return NextResponse.json({ error: 'missing slug' }, { status: 400 })
  }

  try {
    const supabase = createPublicSupabase()
    const { error } = await supabase.rpc('increment_tool_view_count', {
      p_slug: slug,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'view record failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
