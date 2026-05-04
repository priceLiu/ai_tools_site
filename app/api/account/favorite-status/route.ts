import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/session'
import { neonGetFavoritePair } from '@/lib/neon/data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const toolId = new URL(request.url).searchParams.get('toolId')?.trim()
  if (!toolId) {
    return NextResponse.json({ favorited: false }, { status: 400 })
  }
  try {
    const user = await getAuthUser({ allowRedirectOnDisabled: false })
    if (!user) return NextResponse.json({ favorited: false })
    const favorited = await neonGetFavoritePair(user.id, toolId)
    return NextResponse.json({ favorited })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
