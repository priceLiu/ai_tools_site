/**
 * 站点公开域名，用于 metadata `metadataBase`、sitemap、OG / canonical、JSON-LD。
 *
 * 优先级：
 *   1. `SITE_URL`（**推荐**：服务端可读即可，无需 `NEXT_PUBLIC_` 前缀）
 *   2. `NEXT_PUBLIC_SITE_URL`（与上二选一即可；仅当客户端 bundle 也要拼绝对 URL 时用）
 *   3. `VERCEL_URL`（仅 Vercel 自动注入；**腾讯云 / 自建机不会有此项**）
 *   4. 兜底：`https://ai-tools-site-xi.vercel.app`（历史占位；**非 Vercel 生产环境务必配置 1 或 2，否则 canonical/sitemap 全错**）
 *
 * Vercel `VERCEL_URL` 不带 protocol，自动补 `https://`。
 */
let warnedMissingSiteUrl = false

export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    let u = explicit.replace(/\/$/, '')
    // 生产环境公网站点不应再用 http:// canonical / OG；避免 env 误写成 http 拖垮 SEO 与混合内容判断。
    if (process.env.NODE_ENV === 'production' && u.startsWith('http://')) {
      u = `https://${u.slice('http://'.length)}`
    }
    return u
  }

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`

  if (process.env.NODE_ENV === 'production' && !warnedMissingSiteUrl) {
    warnedMissingSiteUrl = true
    console.error(
      '[site-url] 生产环境未设置 SITE_URL / NEXT_PUBLIC_SITE_URL，且不存在 VERCEL_URL。canonical、sitemap、robots.host、OG 绝对地址将使用错误兜底域名。请在腾讯云（或容器）环境变量中设置 SITE_URL=https://你的正式域名（无尾斜杠）。',
    )
  }

  return 'https://ai-tools-site-xi.vercel.app'
}

/** `getSiteUrl()` 的 URL 对象版，便于直接传给 Next `metadataBase`。 */
export function getSiteUrlObject(): URL {
  return new URL(getSiteUrl())
}
