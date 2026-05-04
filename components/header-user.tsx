'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { FrontendLoadingHint } from '@/components/frontend-loading-hint'
import type { AuthUser } from '@/lib/auth/session'
import type { Profile } from '@/lib/types'

/**
 * 静态/ISR 页面专用：在客户端拉取 session + profile 注入 `<Header>`，
 * 让页面 HTML 不依赖 cookie，可被 Full Route Cache / CDN 复用。
 */
export function HeaderUser() {
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

  if (!loaded) {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-center px-4 md:px-6">
          <FrontendLoadingHint className="py-0" />
        </div>
      </header>
    )
  }

  return <Header user={user} profile={profile} />
}
