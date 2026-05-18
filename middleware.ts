import { deployTargetHeaders } from '@/lib/deploy-target'
import { runAuthMiddleware } from '@/lib/auth/middleware-session'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  /**
   * HTTP→HTTPS 强制跳转交给前置网关（CloudBase / CDN / Nginx）。
   * 应用层不做该跳转，避免 CloudBase 把 `Host` 透传成容器监听地址 `0.0.0.0:3000`
   * 时，我们错把用户重定向到 `https://0.0.0.0:3000` 导致 `ERR_CONNECTION_CLOSED`。
   */
  const res = await runAuthMiddleware(request)
  /**
   * 双跑期间在所有响应里附带部署/数据库识别头。
   * 浏览器 DevTools → Network → 任意请求 → Response Headers 即可一眼看出。
   * 详见 lib/deploy-target.ts 与 docs/dual-run-strategy.md。
   */
  for (const [k, v] of Object.entries(deployTargetHeaders())) {
    res.headers.set(k, v)
  }
  return res
}

export const config = {
  matcher: [
    /*
     * 默认除 _next/static / _next/image / favicon / 图片直链 外都走中间件；
     * 额外豁免：
     *  - `about`           ：纯静态介绍页，无任何鉴权诉求；
     *  - `diag`、`api/diag`：诊断页 / 接口，需绕开任何中间层以测出真实延迟；
     *  - `echo`            ：链路诊断页，回显请求 header；
     *  - `api/img/`        ：工具 logo 图片代理，移动端一屏几十张图，没必要逐一过 JWT。
     */
    '/((?!_next/static|_next/image|favicon.ico|about(?:/|$)|diag(?:/|$)|echo(?:/|$)|api/diag|api/img/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
