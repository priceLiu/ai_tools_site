/**
 * 站点公开域名，用于 metadata `metadataBase`、sitemap、OG / canonical、JSON-LD。
 *
 * 优先级：
 *   1. `SITE_URL`（**推荐**：服务端可读即可，无需 `NEXT_PUBLIC_` 前缀）
 *   2. `NEXT_PUBLIC_SITE_URL`（与上二选一即可；仅当客户端 bundle 也要拼绝对 URL 时用）
 *   3. `VERCEL_URL`（仅 Vercel 自动注入；**腾讯云 / 自建机不会有此项**）
 *   4. 兜底：`https://ai-tools-site-xi.vercel.app`（历史占位；**非 Vercel 生产环境务必配置 1 或 2，否则 canonical/sitemap 全错**）
 *
 * 生产环境 **勿**将 `SITE_URL` 设为 `0.0.0.0`、`127.0.0.1`、`localhost`：那是监听地址 / 本机，浏览器无法用来访问线上站点。
 *
 * Vercel `VERCEL_URL` 不带 protocol，自动补 `https://`。
 */
let warnedMissingSiteUrl = false
let warnedInvalidSiteUrlHost = false

/** 生产环境下不可作为对外站点 canonical 的主机名（监听地址 / 本机回环）。 */
function isForbiddenProductionSiteHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === '0.0.0.0' ||
    h === '127.0.0.1' ||
    h === 'localhost' ||
    h === '[::1]' ||
    h === '::1'
  )
}

/** @returns 规范化后的站点 origin（无路径、无尾斜杠），非法或解析失败返回 null */
function tryNormalizeExplicitSiteUrl(raw: string): string | null {
  let u = raw.trim().replace(/\/$/, '')
  if (!u) return null

  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && u.startsWith('http://')) {
    u = `https://${u.slice('http://'.length)}`
  }

  let parsed: URL
  try {
    parsed = new URL(u.includes('://') ? u : `https://${u}`)
  } catch {
    return null
  }

  if (isProd && isForbiddenProductionSiteHost(parsed.hostname)) {
    return null
  }

  return parsed.origin
}

export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    const normalized = tryNormalizeExplicitSiteUrl(explicit)
    if (normalized) {
      return normalized
    }
    if (process.env.NODE_ENV === 'production' && !warnedInvalidSiteUrlHost) {
      warnedInvalidSiteUrlHost = true
      console.error(
        '[site-url] SITE_URL / NEXT_PUBLIC_SITE_URL 无效（例如 0.0.0.0、localhost、127.0.0.1）。' +
          ' Dockerfile 中 HOSTNAME=0.0.0.0 仅表示容器监听所有网卡，不能在浏览器地址栏访问。' +
          ' 请改为正式域名，例如 SITE_URL=https://ai-code8.com',
      )
    }
    // 无效时 fall through，避免 canonical/sitemap 指向不可达地址
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
