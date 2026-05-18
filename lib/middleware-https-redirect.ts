import { NextResponse, type NextRequest } from 'next/server'

function isLocalHost(host: string): boolean {
  const h = host.split(':')[0]?.toLowerCase() ?? ''
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * 从反代头取「用户真实访问的域名」，用于纠正 Host: 0.0.0.0:3000 等错误请求。
 * （CloudBase / Nginx 应在网关设置 X-Forwarded-Host，勿信任客户端伪造。）
 */
function pickForwardedHost(request: NextRequest): string | null {
  const xf = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (!xf || isLocalHost(xf)) return null
  const name = xf.split(':')[0]?.toLowerCase() ?? ''
  if (name === '0.0.0.0') return null
  return xf
}

/**
 * 生产环境把 HTTP 访问重定向到 HTTPS，避免用户从书签/外链落到 http:// 时出现地址栏「不安全」。
 *
 * - 优先读 `x-forwarded-proto`（CDN / Nginx / CLB 终止 TLS 时常用）。
 * - 若未传该头且 `nextUrl.protocol === 'http:'`，视为直连 Node 的明文端口，同样升级。
 * - **Host 为 `0.0.0.0` 时**：绝不能 308 到 `https://0.0.0.0`（浏览器必挂）。此时用 **`x-forwarded-host`** 重写跳转目标；若无该头则 **不重定向**（避免加固错误链接）。
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
  const hostOnly = host.split(':')[0]?.toLowerCase() ?? ''

  if (hostOnly === '0.0.0.0') {
    const replacement = pickForwardedHost(request)
    if (!replacement) {
      return null
    }
    url.host = replacement
  }

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
