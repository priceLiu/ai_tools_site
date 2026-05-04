import type { Metadata } from 'next'

/**
 * 鉴权流程（登录/注册/错误/已禁用）整段不进搜索引擎索引：
 *  - 登录页对搜索流量没有价值；
 *  - 注册成功页 / 账号已禁用页 是状态过渡页；
 *  - 与 `app/robots.ts` 的 `disallow: /auth/` 双重保险。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
