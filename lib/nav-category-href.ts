/** 从侧栏 `navigation_menu_items.href` 解析 `/category/{slug}` 的 slug（用于禁用产品线时剔除菜单项）。 */
export function extractCategorySlugFromHref(href: string): string | null {
  const h = href.trim()
  const prefix = '/category/'
  if (!h.startsWith(prefix)) return null
  const rest = h.slice(prefix.length).split(/[?#]/)[0]?.replace(/\/+$/, '') ?? ''
  if (!rest) return null
  try {
    return decodeURIComponent(rest)
  } catch {
    return rest
  }
}
