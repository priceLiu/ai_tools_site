/** 站内点击打开工具详情时上报访问量（对应 /api/public/tools/[slug]/view POST） */
export function recordToolViewBySlug(slug: string | null | undefined) {
  const s = (slug ?? '').trim()
  if (!s) return
  void fetch(`/api/public/tools/${encodeURIComponent(s)}/view`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => {})
}
