/**
 * 生成站点内工具公开详情路径（单一段路径，slug 中的 `/` 会编码为 %2F，避免 404）
 */
export function toolPublicPath(slug: string | null | undefined): string {
  const s = (slug ?? '').trim()
  if (!s) return '/'
  return `/tool/${encodeURIComponent(s)}`
}
