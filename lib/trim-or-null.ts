/**
 * 数据库/快照里常出现 ''、纯空白，或错误写入的字面量 `"null"` / `"undefined"`，
 * 应视为「无值」以免 next/image、`Link href` 变成对 `/null` 的请求。
 */
export function trimOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (s === '' || s === 'null' || s === 'undefined') return null
  const lower = s.toLowerCase()
  if (lower === 'none' || lower === 'n/a' || lower === 'na') return null
  return s
}

/**
 * 仅保留可作 `img` / `next/image` 的 `src`：`data:`、`http:`、`https:`、
 * 以及站内绝对路径（以 `/` 开头，例如图片代理 `/api/img/...`）。
 * 站点相对路径（无前导 `/`）、无法解析的 URL、空白 src，一律视为无图，避免坏图图标。
 */
export function trimOrNullImageSrc(v: unknown): string | null {
  const s = trimOrNull(v)
  if (!s) return null
  if (s.startsWith('data:')) return s
  if (s.startsWith('/')) return s
  try {
    const u = new URL(s)
    if (u.protocol === 'http:' || u.protocol === 'https:') return s
  } catch {
    return null
  }
  return null
}

/** 导航菜单项：无效 href 回退为首页，避免 `Link href="null"` → `GET /null`。 */
export function normalizeNavMenuHref(href: string | null | undefined): string {
  const s = String(href ?? '').trim()
  if (!s || s === 'null' || s === 'undefined') return '/'
  return s
}
