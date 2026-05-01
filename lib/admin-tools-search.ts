/** PostgREST ilike 通配符转义，并去掉会破坏 .or() 语法的逗号 */
export function escapeIlikePattern(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '')
}

export function buildAdminToolsSearchPattern(raw: string): string {
  return `%${escapeIlikePattern(raw.trim())}%`
}
