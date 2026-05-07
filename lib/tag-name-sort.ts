import type { AdminTagRow } from '@/lib/types'

/**
 * 后台列表里用 `localeCompare()` 若不写 locale，Node 与浏览器默认语言可能不同，
 * 会导致 Client Component SSR 与 hydrate 时 DOM 顺序不一致（hydration mismatch）。
 */
export const ADMIN_TAG_NAME_SORT_LOCALE = 'zh-Hans-CN' as const

export function compareAdminTagRowByDisplayName(
  a: AdminTagRow,
  b: AdminTagRow,
): number {
  const byName = a.name.localeCompare(b.name, ADMIN_TAG_NAME_SORT_LOCALE)
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}
