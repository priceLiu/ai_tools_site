import { NextResponse } from 'next/server'
import { neonGetToolPublicBySlug } from '@/lib/neon/data'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await context.params
  const slug = decodeURIComponent(raw).trim()
  if (!slug) {
    return NextResponse.json({ error: 'missing slug' }, { status: 400 })
  }

  try {
    const data = await neonGetToolPublicBySlug(slug)
    if (!data) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
