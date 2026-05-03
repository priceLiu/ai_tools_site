import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { HomeToolBundle } from '@/lib/home-tool-bundle-types'

export const HOME_BUNDLE_SNAPSHOT_BUCKET = 'site_public_cache' as const
export const HOME_BUNDLE_SNAPSHOT_PATH = 'home-tool-bundle-v1.json' as const

/** 匿名可读的 Storage 公开 URL（与 Dashboard「公开 bucket」一致） */
export function getHomeBundleSnapshotPublicUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return null
  return `${base}/storage/v1/object/public/${HOME_BUNDLE_SNAPSHOT_BUCKET}/${HOME_BUNDLE_SNAPSHOT_PATH}`
}

function isHomeToolBundleLike(v: unknown): v is HomeToolBundle {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    Array.isArray(o.categories) &&
    Array.isArray(o.featured) &&
    Array.isArray(o.latest) &&
    Array.isArray(o.homeCategoryBlocks)
  )
}

/** 从 Supabase Storage 拉取 JSON；404 / 失败返回 null */
export async function fetchHomeToolBundleFromSnapshot(): Promise<HomeToolBundle | null> {
  if (process.env.HOME_BUNDLE_SNAPSHOT_DISABLE === '1') return null

  const url = getHomeBundleSnapshotPublicUrl()
  if (!url) return null

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const raw: unknown = await res.json()
    if (!isHomeToolBundleLike(raw)) return null
    return raw
  } catch {
    return null
  }
}

/**
 * 将当前 bundle 写入 Storage（需 SUPABASE_SERVICE_ROLE_KEY）。
 * 在工具/菜单变更后的 revalidate 流程中调用。
 */
export async function uploadHomeToolBundleSnapshot(
  bundle: HomeToolBundle,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createServiceRoleClient()
  if (!admin) {
    return { ok: false, error: '缺少 SUPABASE_SERVICE_ROLE_KEY，跳过快照上传' }
  }

  const body = JSON.stringify(bundle)
  const blob = new Blob([body], { type: 'application/json' })

  const { error } = await admin.storage
    .from(HOME_BUNDLE_SNAPSHOT_BUCKET)
    .upload(HOME_BUNDLE_SNAPSHOT_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '120',
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
