'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loadHomeToolBundle } from '@/lib/cached-home-data'
import { uploadHomeToolBundleSnapshot } from '@/lib/home-bundle-snapshot'
import { HOME_TOOL_BUNDLE_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

/**
 * 工具/分类等影响首页列表时调用：失效相关 Data Cache tag，并把当前 bundle 写入 Supabase Storage（需 service role + bucket 迁移）。
 * @returns snapshotOk 为 false 时首页仍可能通过直接查库展示，但 Storage 快照未更新。
 */
export async function revalidateHomeToolBundleAction(): Promise<{
  snapshotOk: boolean
  snapshotError?: string
}> {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  const bundle = await loadHomeToolBundle()
  const uploaded = await uploadHomeToolBundleSnapshot(bundle)
  if (!uploaded.ok && process.env.NODE_ENV === 'development') {
    console.warn('[revalidateHomeToolBundle]', uploaded.error)
  }
  return {
    snapshotOk: uploaded.ok,
    snapshotError: uploaded.error,
  }
}

/**
 * 管理员手动强制：按当前数据库重建首页快照并 revalidatePath('/')。
 * 用于在控制台直接改分类/工具后同步线上首页。
 */
export async function forceRefreshHomeBundleSnapshotAdminAction(): Promise<{
  ok: boolean
  message: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: '未登录' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { ok: false, message: '无权限' }

  const res = await revalidateHomeToolBundleAction()
  revalidatePath('/')

  if (res.snapshotOk) {
    return { ok: true, message: '已更新：首页 Storage 快照与相关缓存标签已刷新。' }
  }
  return {
    ok: true,
    message: `已刷新首页路径。Storage 快照未写入：${res.snapshotError ?? '请配置 SUPABASE_SERVICE_ROLE_KEY 并执行 site_public_cache 迁移'}。此期间首页会回退为直接读数据库。`,
  }
}
