import { NextResponse, type NextRequest } from 'next/server'
import { getPublicRequestOrigin } from '@/lib/request-public-origin'
import { SESSION_COOKIE_NAME } from './constants'
import { verifySessionToken } from './jwt'

/**
 * Slug 含未编码 `/` 时合并为单段。
 * @returns 若需重定向则返回 NextResponse，否则 null
 */
export function maybeRedirectToolSlug(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/tool/') && pathname.length > '/tool/'.length) {
    const rest = pathname.slice('/tool/'.length)
    const segments = rest.split('/')
    if (segments.length > 1) {
      const slug = segments
        .map((seg) => {
          try {
            return decodeURIComponent(seg)
          } catch {
            return seg
          }
        })
        .join('/')
      const url = new URL(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        getPublicRequestOrigin(request),
      )
      url.pathname = `/tool/${encodeURIComponent(slug)}`
      return NextResponse.redirect(url, 308)
    }
  }
  return null
}

/**
 * Edge Middleware 不使用 Neon（避免 @neondatabase/serverless 的 fetch 在本机/部分网络失败）。
 * `profiles.is_disabled` 在登录时写入 JWT；管理员事后禁用由 Node 端的 `getAuthUser` 查库后清 cookie 并跳转。
 */
export async function runAuthMiddleware(
  request: NextRequest,
): Promise<NextResponse> {
  const slugRedirect = maybeRedirectToolSlug(request)
  if (slugRedirect) return slugRedirect

  let res = NextResponse.next({ request })

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  const user = token ? await verifySessionToken(token) : null

  if (
    user?.disabled &&
    !request.nextUrl.pathname.startsWith('/auth/account-disabled')
  ) {
    const disabledUrl = new URL('/auth/account-disabled', getPublicRequestOrigin(request))
    const redirectResponse = NextResponse.redirect(disabledUrl)
    redirectResponse.cookies.delete(SESSION_COOKIE_NAME)
    return redirectResponse
  }

  if (
    request.nextUrl.pathname.startsWith('/protected') &&
    !user
  ) {
    const url = new URL('/auth/login', getPublicRequestOrigin(request))
    return NextResponse.redirect(url)
  }

  return res
}
