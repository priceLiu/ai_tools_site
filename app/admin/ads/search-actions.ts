'use server'

import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { buildAdminToolsSearchPattern } from '@/lib/admin-tools-search'
import type { Tool } from '@/lib/types'

/** 后台广告位编辑器：搜索可关联的工具（仅管理员） */
export async function searchToolsForAdminAction(keyword: string): Promise<Tool[]> {
  const user = await getAuthUser()
  if (!user) throw new Error('未登录')
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) throw new Error('无权限')

  const t = (keyword ?? '').trim()
  if (!t) return []
  const pattern = buildAdminToolsSearchPattern(t)
  return neon.neonListToolsAdminSearch(pattern, 30)
}

/** 获取可选工具列表（已审核的前 100 个） */
export async function listAvailableToolsForAdAction(): Promise<
  Pick<Tool, 'id' | 'name' | 'slug'>[]
> {
  const user = await getAuthUser()
  if (!user) throw new Error('未登录')
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) throw new Error('无权限')

  return neon.neonListApprovedToolsForSelect(100)
}
