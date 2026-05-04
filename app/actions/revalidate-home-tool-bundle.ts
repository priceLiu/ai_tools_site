'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getAuthUser } from '@/lib/auth/session'
import { neonGetProfileIsAdmin } from '@/lib/neon/data'
import { loadHomeToolBundle } from '@/lib/cached-home-data'
import { uploadHomeToolBundleSnapshot } from '@/lib/home-bundle-snapshot'
import {
  HOME_TOOL_BUNDLE_CACHE_TAG,
  NAVIGATION_MENU_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

/**
 * 工具/分类等影响首页列表时调用。
 *
 * 先 `revalidateTag` 失效 Data Cache 与 `revalidatePath('/')` 让 ISR 在下次访问时重建；
 * `app_kv` 快照重建放进 `after()`，**不阻塞**当前 Server Action 响应。
 */
export async function revalidateHomeToolBundleAction(): Promise<{
  scheduled: true
}> {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidatePath('/')

  after(async () => {
    try {
      const bundle = await loadHomeToolBundle()
      const uploaded = await uploadHomeToolBundleSnapshot(bundle)
      if (!uploaded.ok && process.env.NODE_ENV === 'development') {
        console.warn('[revalidateHomeToolBundle/after]', uploaded.error)
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[revalidateHomeToolBundle/after] rebuild failed:', e)
      }
    }
  })

  return { scheduled: true }
}

/**
 * 管理员手动「生成静态」：一键失效全站静态缓存（首页 / 分类 / 详情 / 导航 + 首页 bundle Data Cache）
 * 并同步重建 `app_kv` 首页快照，方便上线后立刻拿到最新 HTML。
 *
 * Next.js 的 ISR 失效是「下一次访问触发重建」，所以这里相当于「按发布」：
 * - 失效后立即可见的页面，浏览器再次请求时会拿到最新 HTML。
 * - 动态岛（收藏数 / 评论 / 用户登录态）走客户端 fetch，不依赖 ISR。
 */
export async function regeneratePublicStaticAction(): Promise<{
  ok: boolean
  message: string
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, message: '未登录' }

  const ok = await neonGetProfileIsAdmin(user.id)
  if (!ok) return { ok: false, message: '无权限' }

  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/category/[slug]', 'page')
  revalidatePath('/tool/[slug]', 'page')

  try {
    const bundle = await loadHomeToolBundle()
    const uploaded = await uploadHomeToolBundleSnapshot(bundle)
    if (uploaded.ok) {
      return {
        ok: true,
        message: '已生成静态：首页 / 分类 / 详情 ISR 已失效，首页快照已重建。',
      }
    }
    return {
      ok: true,
      message: `静态页缓存已失效。app_kv 快照未写入：${uploaded.error ?? '请检查 DATABASE_URL 与 app_kv 表'}。`,
    }
  } catch (e) {
    return {
      ok: true,
      message: `静态页缓存已失效。快照重建失败：${e instanceof Error ? e.message : String(e)}`,
    }
  }
}
