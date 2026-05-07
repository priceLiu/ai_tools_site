'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { FrontendLoadingHint } from '@/components/frontend-loading-hint'
import { MobileNavSheet } from '@/components/mobile-nav-sheet'
import { loadAuthMe, type AuthMe } from '@/lib/client-auth-me-cache'
import type { NavigationMenuTreeNode } from '@/lib/types'

interface HeaderUserProps {
  /** 桌面侧栏的同一份 navigation；移动端 header 用它做汉堡抽屉 */
  navigation?: NavigationMenuTreeNode[]
  /** 仅首页传 true：抽屉里的菜单项点击会平滑滚到首页对应区块 */
  enableHomeAnchors?: boolean
}

/**
 * 静态/ISR 页面专用：在客户端通过合并端点 `/api/auth/me` 一次性拿 session + profile。
 *
 * 优化点：
 * - 同 tab 内导航 / 刷新都从内存 + sessionStorage 缓存读取，第二次访问 0ms；
 * - 首屏拿到缓存就直接渲染真实 header，跳过加载占位；
 * - 失败降级为未登录态，避免阻塞页面交互。
 */
export function HeaderUser({
  navigation = [],
  enableHomeAnchors = false,
}: HeaderUserProps) {
  // 初始 null 与 SSR 一致，避免 hydration mismatch；mount 后再读缓存 / 拉取。
  const [me, setMe] = useState<AuthMe | null>(null)

  useEffect(() => {
    let cancelled = false
    // loadAuthMe 内部命中缓存时立即 resolve，UI 在下一个 microtask 就能拿到结果。
    void loadAuthMe().then((v) => {
      if (!cancelled) setMe(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const mobileNav =
    navigation.length > 0 ? (
      <MobileNavSheet
        navigation={navigation}
        enableHomeAnchors={enableHomeAnchors}
      />
    ) : null

  if (!me) {
    return (
      <div className="flex h-14 items-center justify-between gap-3 px-3 md:h-16 md:gap-4 md:px-6">
        {mobileNav}
        <div className="flex flex-1 justify-center">
          <FrontendLoadingHint className="py-0" />
        </div>
      </div>
    )
  }

  return <Header user={me.user} profile={me.profile} mobileNav={mobileNav} />
}
