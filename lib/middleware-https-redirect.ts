import { NextResponse, type NextRequest } from 'next/server'

function isLocalHost(host: string): boolean {
  const h = host.split(':')[0]?.toLowerCase() ?? ''
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * 生产环境把 HTTP 访问重定向到 HTTPS，避免用户从书签/外链落到 http:// 时出现地址栏「不安全」。
 *
 * - 优先读 `x-forwarded-proto`（CDN / Nginx / CLB 终止 TLS 时常用）。
 * - 若未传该头且 `nextUrl.protocol === 'http:'`，视为直连 Node 的明文端口，同样升级。
 *
 * 开发环境、localhost 不重定向，以免 `next dev` 不可用。
 */
export function maybeHttpsRedirect(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  const host = request.headers.get('host') ?? ''
  if (!host || isLocalHost(host)) {
    return null
  }

  const forwardedRaw = request.headers.get('x-forwarded-proto')
  const forwarded = forwardedRaw?.split(',')[0]?.trim().toLowerCase()

  const url = request.nextUrl.clone()

  if (forwarded === 'http') {
    url.protocol = 'https:'
    return NextResponse.redirect(url, 308)
  }

  if (!forwardedRaw && url.protocol === 'http:') {
    url.protocol = 'https:'
    return NextResponse.redirect(url, 308)
  }

  return null
}
