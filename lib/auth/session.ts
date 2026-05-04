import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { neonGetProfileIsDisabled } from '@/lib/neon/data'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from './constants'
import { signSessionToken, verifySessionToken } from './jwt'

export type AuthUser = { id: string; email: string }

export type GetAuthUserOptions = {
  /**
   * `false`：用于 Route Handler / 程序化调用，禁用账号时只清 cookie 并返回 null，不 `redirect`。
   * 默认 `true`：Server Component / Server Action 下跳转 `/auth/account-disabled`。
   */
  allowRedirectOnDisabled?: boolean
}

/** 单次 RSC 请求内合并多次 `getAuthUser` 调用（仅按 `allowRedirectOnDisabled` 分支缓存）。 */
const getAuthUserCached = cache(
  async (allowRedirect: boolean): Promise<AuthUser | null> => {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null
    const v = await verifySessionToken(token)
    if (!v) return null

    const clearSession = () => cookieStore.delete(SESSION_COOKIE_NAME)

    if (v.disabled) {
      clearSession()
      if (allowRedirect) {
        redirect('/auth/account-disabled')
      }
      return null
    }

    try {
      const dbDisabled = await neonGetProfileIsDisabled(v.id)
      if (dbDisabled === true) {
        clearSession()
        if (allowRedirect) {
          redirect('/auth/account-disabled')
        }
        return null
      }
      if (dbDisabled === null) {
        clearSession()
        return null
      }
    } catch (e) {
      console.warn('[getAuthUser] is_disabled revalidation failed:', e)
    }

    return { id: v.id, email: v.email }
  },
)

export async function getAuthUser(
  options?: GetAuthUserOptions,
): Promise<AuthUser | null> {
  const allowRedirect = options?.allowRedirectOnDisabled !== false
  return getAuthUserCached(allowRedirect)
}

export async function setSessionCookie(
  userId: string,
  email: string,
  isDisabled = false,
) {
  const token = await signSessionToken(userId, email, isDisabled)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
