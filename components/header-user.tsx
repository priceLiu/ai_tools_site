'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { FrontendLoadingHint } from '@/components/frontend-loading-hint'
import { MobileNavSheet } from '@/components/mobile-nav-sheet'
import type { AuthUser } from '@/lib/auth/session'
import type { NavigationMenuTreeNode, Profile } from '@/lib/types'

interface HeaderUserProps {
  /** 桌面侧栏的同一份 navigation；移动端 header 用它做汉堡抽屉 */
  navigation?: NavigationMenuTreeNode[]
  /** 仅首页传 true：抽屉里的菜单项点击会平滑滚到首页对应区块 */
  enableHomeAnchors?: boolean
}

/**
 * 静态/ISR 页面专用：在客户端拉取 session + profile 注入 `<Header>`，
 * 让页面 HTML 不依赖 cookie，可被 Full Route Cache / CDN 复用。
 */
export function HeaderUser({
  navigation = [],
  enableHomeAnchors = false,
}: HeaderUserProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const r = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!r.ok) {
          if (!cancelled) setLoaded(true)
          return
        }
        const j = (await r.json()) as { user: AuthUser | null }
        if (cancelled) return
        const u = j.user ?? null
        setUser(u)
        if (!u) return
        const pr = await fetch('/api/account/profile', { cache: 'no-store' })
        if (!pr.ok) {
          if (!cancelled) setLoaded(true)
          return
        }
        const p = (await pr.json()) as Profile | null
        if (!cancelled) setProfile(p)
      } catch {
        /* 静默失败：未登录态正常渲染登录/注册按钮 */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()

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

  if (!loaded) {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center justify-between gap-3 px-3 md:h-16 md:gap-4 md:px-6">
          {mobileNav}
          <div className="flex flex-1 justify-center">
            <FrontendLoadingHint className="py-0" />
          </div>
        </div>
      </header>
    )
  }

  return <Header user={user} profile={profile} mobileNav={mobileNav} />
}
