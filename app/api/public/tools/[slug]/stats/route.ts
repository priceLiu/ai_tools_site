import { NextResponse } from 'next/server'
import { neonGetToolPublicStatsBySlug } from '@/lib/neon/data'

/**
 * 给详情页 / 列表页客户端拉「真实」view + favorite 计数。
 * 详情页 HTML 走 60s ISR，初始值可能比 DB 旧；本接口提供低成本同步。
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) return NextResponse.json(null, { status: 400 })

  try {
    const data = await neonGetToolPublicStatsBySlug(slug)
    if (!data) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed'
    console.error('[/api/public/tools/[slug]/stats] failed', {
      slug,
      message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
