import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { HOME_TOOL_BUNDLE_CACHE_TAG } from '@/lib/navigation-menu-cache-config'
import { neonIncrementToolViewCount } from '@/lib/neon/data'

export const dynamic = 'force-dynamic'

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
    await neonIncrementToolViewCount(slug)
    revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'view record failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
