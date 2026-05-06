/**
 * 标签 URL 处理：
 *
 * `tags` 表只有 `name`（lower(trim(name)) 唯一），没有 slug 列。
 * 因此 `/tag/[slug]` 直接用「URL 编码后的名称」作为参数：
 *   - 编码：`encodeURIComponent(name)`
 *   - 解码 + 大小写归一：`decodeURIComponent(slug)`
 *
 * 注意：调用方只需要保证服务器端用 `neonGetTagByName(decoded)` 反查即可。
 */

export function tagPublicPath(name: string): string {
  return `/tag/${encodeURIComponent(name)}`
}

export function tagCategoryPublicPath(slug: string): string {
  return `/tag-category/${encodeURIComponent(slug)}`
}

export function rolePublicPath(slug: string): string {
  return `/role/${encodeURIComponent(slug)}`
}

export function decodeTagNameFromSlug(slug: string): string {
  try {
    return decodeURIComponent(slug ?? '')
      .normalize('NFKC')
      .trim()
  } catch {
    return (slug ?? '').trim()
  }
}
