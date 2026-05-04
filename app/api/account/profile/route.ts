import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/session'
import { neonGetProfileById } from '@/lib/neon/data'

export const dynamic = 'force-dynamic'

/** 供客户端读取当前登录用户的 profiles；未登录返回 null */
export async function GET() {
  try {
    const user = await getAuthUser({ allowRedirectOnDisabled: false })
    if (!user) return NextResponse.json(null)
    const p = await neonGetProfileById(user.id)
    return NextResponse.json(p)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
