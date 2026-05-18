import type { NextRequest } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

/** 监听占位 Host；浏览器无法访问，不能做 Location / cookie Domain。 */
function isBrokenRedirectHostname(hostname: string): boolean {
  return hostname.toLowerCase() === '0.0.0.0'
}

/**
 * 构造对外重定向用的 origin。
 * 前置网关若误传 `Host: 0.0.0.0:3000`，优先用 `X-Forwarded-Host`（及 Proto），否则回退 `SITE_URL`。
 *
 * 仅在反向代理已剥离伪造 forwarded、或由平台注入 forwarded 的场景下安全；
 * 若容器可被公网直连且未校验 header，应通过网络层限制直连。
 */
export function getPublicRequestOrigin(request: NextRequest | Request): string {
  const xfHostFirst = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const xfProtoFirst =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() ?? ''

  if (xfHostFirst) {
    let xfHostname: string
    try {
      xfHostname = new URL(`http://${xfHostFirst}`).hostname
    } catch {
      xfHostname = xfHostFirst.split(':')[0] ?? ''
    }
    if (xfHostname && !isBrokenRedirectHostname(xfHostname)) {
      const proto =
        xfProtoFirst === 'http' || xfProtoFirst === 'https'
          ? xfProtoFirst
          : process.env.NODE_ENV === 'production'
            ? 'https'
            : 'http'
      try {
        return new URL(`${proto}://${xfHostFirst}`).origin
      } catch {
        /* fall through */
      }
    }
  }

  try {
    const nextUrl = 'nextUrl' in request ? (request as NextRequest).nextUrl : null
    const hostname = nextUrl?.hostname ?? new URL(request.url).hostname
    if (!isBrokenRedirectHostname(hostname)) {
      return nextUrl?.origin ?? new URL(request.url).origin
    }
  } catch {
    return getSiteUrl()
  }

  return getSiteUrl()
}
