'use client'

import type { AuthUser } from '@/lib/auth/session'
import type { Profile } from '@/lib/types'

export interface AuthMe {
  user: AuthUser | null
  profile: Profile | null
}

const SESSION_KEY = 'auth-me:v1'

/** 模块级缓存 + 同进程并发去重；同一 tab 多个 `<HeaderUser>` 只发一个网络请求。 */
let memoryCache: AuthMe | null = null
let inflight: Promise<AuthMe> | null = null

function readSessionStorage(): AuthMe | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthMe
  } catch {
    return null
  }
}

function writeSessionStorage(v: AuthMe): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(v))
  } catch {
    /* quota / privacy mode：忽略，下次再 fetch */
  }
}

/** 登出 / 切账号时调用，下一次 `loadAuthMe` 会重新走网络。 */
export function invalidateAuthMeCache(): void {
  memoryCache = null
  inflight = null
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }
}

/** 同步取本地缓存；若没有，返回 null，让 UI 进入 loading。 */
export function getCachedAuthMeSync(): AuthMe | null {
  if (memoryCache) return memoryCache
  const ss = readSessionStorage()
  if (ss) {
    memoryCache = ss
    return ss
  }
  return null
}

/**
 * 异步加载 `{ user, profile }`：
 * - 有缓存 → 立即 resolve；
 * - 否则发 `/api/auth/me`，并把结果写回缓存（同 tab 内导航不再重复请求）。
 *
 * 失败时返回 `{ user: null, profile: null }`：未登录态降级，UI 仍可工作。
 */
export async function loadAuthMe(): Promise<AuthMe> {
  const cached = getCachedAuthMeSync()
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!r.ok) return { user: null, profile: null }
      const j = (await r.json()) as AuthMe & { error?: string }
      const v: AuthMe = { user: j.user ?? null, profile: j.profile ?? null }
      memoryCache = v
      writeSessionStorage(v)
      return v
    } catch {
      return { user: null, profile: null }
    } finally {
      inflight = null
    }
  })()
  return inflight
}
