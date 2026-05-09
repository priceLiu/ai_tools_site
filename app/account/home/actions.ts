'use server'

import { revalidatePath } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { getAuthUser } from '@/lib/auth/session'
import type {
  PortalSectionConfigEntry,
  PortalThemeId,
} from '@/lib/types'

function canonSections(raw: PortalSectionConfigEntry[]): PortalSectionConfigEntry[] {
  const allowed = new Set(['follows', 'favorites', 'comments', 'submissions'])
  const cleaned = raw
    .filter((r) => allowed.has(r.id))
    .map((r, i) => ({
      id: r.id,
      visible: r.visible !== false,
      order: Number(r.order ?? i),
    }))
  return cleaned.length ? cleaned : []
}

export async function savePortalSectionsAction(
  sections: PortalSectionConfigEntry[],
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '请先登录' }
  const p = await neon.neonGetProfileById(user.id)
  if (p?.portal_disabled_by_admin === true) {
    return { error: '管理员已关闭个人门户功能' }
  }
  await neon.neonUpdateProfilePortalPreferences(user.id, {
    portal_section_config: canonSections(sections),
  })
  revalidatePath('/account/home')
  revalidatePath('/account/profile')
  return {}
}

export async function savePortalThemeAction(
  theme: PortalThemeId | string,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '请先登录' }
  const p = await neon.neonGetProfileById(user.id)
  if (p?.portal_disabled_by_admin === true) {
    return { error: '管理员已关闭个人门户功能' }
  }
  const t =
    theme === 'minimal' || theme === 'dense' || theme === 'default'
      ? theme
      : 'default'
  await neon.neonUpdateProfilePortalPreferences(user.id, {
    portal_theme: t,
  })
  revalidatePath('/account/home')
  return {}
}

export async function setPortalHomeEnabledAction(
  enabled: boolean,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '请先登录' }
  const p = await neon.neonGetProfileById(user.id)
  if (p?.portal_disabled_by_admin === true && enabled) {
    return { error: '管理员已强制关闭门户，无法自行开启' }
  }
  await neon.neonUpdateProfilePortalPreferences(user.id, {
    portal_home_enabled: enabled,
  })
  revalidatePath('/account/home')
  revalidatePath('/account/profile')
  revalidatePath('/account')
  return {}
}

export async function submitShowcaseApplicationAction(input: {
  title: string
  summary: string
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '请先登录' }
  const r = await neon.neonSubmitShowcaseApplication(user.id, input)
  if (r.error) return r
  revalidatePath('/account/home')
  revalidatePath('/admin/showcases')
  return {}
}

export async function requestShowcaseRevokePublicationAction(): Promise<{
  error?: string
}> {
  const user = await getAuthUser()
  if (!user) return { error: '请先登录' }
  const r = await neon.neonRequestShowcaseRevokePublication(user.id)
  if (r.error) return r
  revalidatePath('/account/home')
  revalidatePath('/admin/showcases')
  return {}
}
