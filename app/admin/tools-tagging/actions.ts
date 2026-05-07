'use server'

import { getAuthUser } from '@/lib/auth/session'
import {
  neonAdminGetToolTagsForEditor,
  neonAdminListTagsForRoleCategoryPicklist,
  neonAdminSearchTagsForPicker,
  neonAdminSearchToolsForTagging,
  neonGetProfileIsAdmin,
  type AdminTagPickerRow,
  type AdminTagSceneFilter,
} from '@/lib/neon/data'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: '未登录' }
  const isAdmin = await neonGetProfileIsAdmin(user.id)
  if (!isAdmin) return { ok: false, error: '无权限' }
  return { ok: true }
}

function parseSceneFilter(scene: string): AdminTagSceneFilter | null {
  const s = scene.trim()
  if (s === 'all') return { kind: 'all' }
  if (s === 'uncategorized') return { kind: 'uncategorized' }
  if (UUID_RE.test(s)) return { kind: 'scene', tagCategoryId: s }
  return null
}

export async function adminSearchToolsForTaggingAction(input: {
  query: string
}): Promise<
  | { ok: true; tools: { id: string; name: string; slug: string; status: string }[] }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  const tools = await neonAdminSearchToolsForTagging({
    query: input.query ?? '',
  })
  return { ok: true, tools }
}

export async function adminSearchTagsForPickerAction(input: {
  query: string
  scene: string
}): Promise<{ ok: true; tags: AdminTagPickerRow[] } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  const parsed = parseSceneFilter(input.scene ?? 'all')
  if (!parsed) return { ok: false, error: '无效的场景筛选' }
  const tags = await neonAdminSearchTagsForPicker({
    query: input.query ?? '',
    scene: parsed,
  })
  return { ok: true, tags }
}

export async function adminGetToolTagsForEditorAction(input: {
  toolId: string
}): Promise<
  | {
      ok: true
      tags: { name: string; tag_category_id: string | null }[]
    }
  | { ok: false; error: string }
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  const id = (input.toolId ?? '').trim()
  if (!UUID_RE.test(id)) return { ok: false, error: '无效的工具 id' }
  const tags = await neonAdminGetToolTagsForEditor(id)
  return { ok: true, tags }
}

export async function adminListRoleCategoryTagsPickerAction(input: {
  roleCategoryId: string
}): Promise<{ ok: true; tags: AdminTagPickerRow[] } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  const id = (input.roleCategoryId ?? '').trim()
  if (!UUID_RE.test(id)) return { ok: false, error: '无效的角色分类 id' }
  const tags = await neonAdminListTagsForRoleCategoryPicklist(id)
  return { ok: true, tags }
}
