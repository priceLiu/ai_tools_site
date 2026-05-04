/**
 * 站点公开域名，用于 metadata `metadataBase`、sitemap、OG / canonical。
 *
 * 优先级：
 *   1. `SITE_URL`（推荐，明确写绝对 URL，不带斜杠）
 *   2. `NEXT_PUBLIC_SITE_URL`（少数客户端代码用得到时回退）
 *   3. `VERCEL_URL`（Vercel 自动注入；Preview 部署也能拿到）
 *   4. 兜底：当前生产域名 `https://ai-tools-site-xi.vercel.app`
 *
 * Vercel `VERCEL_URL` 不带 protocol，自动补 `https://`。
 */
export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`

  return 'https://ai-tools-site-xi.vercel.app'
}

/** `getSiteUrl()` 的 URL 对象版，便于直接传给 Next `metadataBase`。 */
export function getSiteUrlObject(): URL {
  return new URL(getSiteUrl())
}
