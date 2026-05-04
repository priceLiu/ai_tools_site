import { runAuthMiddleware } from '@/lib/auth/middleware-session'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return runAuthMiddleware(request)
}

export const config = {
  matcher: [
    /*
     * 默认除 _next/static / _next/image / favicon / 图片直链 外都走中间件；
     * 额外豁免：
     *  - `about`           ：纯静态介绍页，无任何鉴权诉求；
     *  - `api/img/`        ：工具 logo 图片代理，移动端一屏几十张图，没必要逐一过 JWT。
     */
    '/((?!_next/static|_next/image|favicon.ico|about(?:/|$)|api/img/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
