'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { getAdSettings, saveAdSettings } from '@/lib/ad-settings'
import type { AdSettings } from '@/lib/types'
import { HOME_ADS_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

async function requireAdmin() {
  const user = await getAuthUser()
  if (!user) throw new Error('未登录')
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) throw new Error('无权限')
  return { user }
}

function refreshHomeAds() {
  revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/admin/ads')
}

function asISO(s: string | null | undefined): string {
  const t = (s ?? '').trim()
  if (!t) throw new Error('日期不能为空')
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) throw new Error('日期无效')
  return d.toISOString()
}

function clampPrice(v: number | string): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function normalizeBanner(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  if (t.startsWith('data:image/')) {
    if (t.length > 3_500_000) {
      throw new Error('Banner 图过大（请控制在 ~2.5MB 以内）')
    }
    return t
  }
  try {
    return new URL(t).toString()
  } catch {
    throw new Error('Banner 必须是 http(s) 链接或 data:image')
  }
}

export interface AdFormInput {
  id?: string
  tool_id: string
  placement: 'section1' | 'section2'
  tab_key?: 'A' | 'B' | 'C' | null
  banner_url?: string | null
  price: number
  starts_at: string
  ends_at: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  sort_order?: number
}

export async function adminUpsertAdAction(input: AdFormInput): Promise<{
  id: string
}> {
  const { user } = await requireAdmin()

  if (!input.tool_id?.trim()) throw new Error('请选择关联工具')
  if (input.placement === 'section1') {
    if (input.tab_key !== 'A' && input.tab_key !== 'B' && input.tab_key !== 'C') {
      throw new Error('Section 1 必须选择 Tab A、B 或 C')
    }
  }
  const banner = normalizeBanner(input.banner_url ?? null)
  if (input.placement === 'section2' && !banner) {
    throw new Error('Section 2 必须上传 Banner 图')
  }
  const startsAt = asISO(input.starts_at)
  const endsAt = asISO(input.ends_at)
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('结束时间必须晚于开始时间')
  }

  const status = input.status ?? 'pending'

  // 检查同一工具在同一版块、同一时段是否已有 approved 投放（允许跨版块）
  if (status === 'approved') {
    const overlap = await neon.neonCheckAdOverlap({
      tool_id: input.tool_id,
      placement: input.placement,
      starts_at: startsAt,
      ends_at: endsAt,
      exclude_id: input.id,
    })
    if (overlap) {
      throw new Error(
        `该工具在 ${input.placement === 'section1' ? 'Section 1' : 'Section 2'} 的这段时间已有一条生效投放，请先下线或调整时段`,
      )
    }
  }

  if (input.id?.trim()) {
    await neon.neonUpdateAd({
      id: input.id,
      tool_id: input.tool_id,
      placement: input.placement,
      tab_key: input.placement === 'section1' ? input.tab_key ?? null : null,
      banner_url: banner,
      price: clampPrice(input.price),
      starts_at: startsAt,
      ends_at: endsAt,
      status,
      rejection_reason:
        status === 'rejected' ? input.rejection_reason?.trim() || null : null,
      sort_order:
        typeof input.sort_order === 'number' ? input.sort_order : undefined,
    })
    refreshHomeAds()
    return { id: input.id }
  }

  const newId = await neon.neonInsertAd({
    tool_id: input.tool_id,
    placement: input.placement,
    tab_key: input.placement === 'section1' ? input.tab_key ?? null : null,
    banner_url: banner,
    price: clampPrice(input.price),
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    sort_order:
      typeof input.sort_order === 'number'
        ? input.sort_order
        : Math.floor(Date.now() / 1000) % 1_000_000,
    submitted_by: user.id,
  })
  refreshHomeAds()
  return { id: newId }
}

export async function adminDeleteAdAction(id: string): Promise<void> {
  await requireAdmin()
  if (!id?.trim()) throw new Error('id 缺失')
  await neon.neonDeleteAd(id)
  refreshHomeAds()
}

export async function adminSetAdStatusAction(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  reason?: string | null,
): Promise<void> {
  await requireAdmin()
  await neon.neonUpdateAdStatus(
    id,
    status,
    status === 'rejected' ? reason?.trim() || '未注明' : null,
  )
  refreshHomeAds()
}

export async function adminUpdateAdSortOrderAction(
  id: string,
  sort_order: number,
): Promise<void> {
  await requireAdmin()
  await neon.neonUpdateAdSortOrder(id, Math.floor(Number(sort_order) || 0))
  refreshHomeAds()
}

export async function adminSaveAdSettingsAction(
  patch: Partial<AdSettings>,
): Promise<AdSettings> {
  await requireAdmin()
  const next = await saveAdSettings(patch)
  refreshHomeAds()
  return next
}

/** 仅查询的便捷封装（给客户端组件用） */
export async function adminGetAdSettingsAction(): Promise<AdSettings> {
  await requireAdmin()
  return getAdSettings()
}
