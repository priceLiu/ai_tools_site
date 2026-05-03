import { NextResponse } from 'next/server'
import { createPublicSupabase } from '@/lib/supabase/public'

export const dynamic = 'force-dynamic'

/**
 * 与首页 `getHomeToolBundle` 相同：匿名 Supabase 客户端。
 * 解决登录用户浏览器端带 JWT 时，若 RLS 仅允许 anon 读「已通过」工具，导致详情页 `.single()` 取不到数据的问题。
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params
  const slug = decodeURIComponent(raw).trim()
  if (!slug) {
    return NextResponse.json({ error: 'missing slug' }, { status: 400 })
  }

  const supabase = createPublicSupabase()
  const { data, error } = await supabase
    .from('tools')
    .select(
      '*, category:categories(*), tool_tags(sort_order, tag:tags(id,name))',
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_disabled', false)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json(null, { status: 404 })
  }

  return NextResponse.json(data)
}
