import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/session'
import { neonGetProfileById } from '@/lib/neon/data'

/**
 * 给客户端 `<HeaderUser>` 一次性返回 `{ user, profile }`，
 * 取代原本的 `/api/auth/session` + `/api/account/profile` 串行两次 fetch；
 * Neon 在跨区 / 冷启动下两次 RTT 容易堆到 5–8s，合并后只剩一次。
 *
 * 始终 force-dynamic + no-store：客户端用自己的内存 / sessionStorage 缓存，
 * 服务端不应再被 Next 视为可缓存的 GET。
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getAuthUser({ allowRedirectOnDisabled: false })
    if (!user) {
      return NextResponse.json(
        { user: null, profile: null },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const profile = await neonGetProfileById(user.id)
    return NextResponse.json(
      { user, profile },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        user: null,
        profile: null,
        error: e instanceof Error ? e.message : 'failed',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
