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

/** 历史 Vercel 占位；非该部署时不应作为 robots/sitemap 的 Host。 */
export const SITE_URL_VERCEL_PLACEHOLDER = 'https://ai-tools-site-xi.vercel.app'

function originFromHostHeader(hostRaw: string, protoHint?: string): string | null {
  const host = hostRaw.split(',')[0]?.trim()
  if (!host) return null

  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    hostname = host.split(':')[0] ?? ''
  }
  if (!hostname || isForbiddenProductionSiteHost(hostname)) return null

  const proto =
    protoHint === 'http' || protoHint === 'https'
      ? protoHint
      : process.env.NODE_ENV === 'production'
        ? 'https'
        : 'http'
  try {
    return new URL(`${proto}://${host}`).origin
  } catch {
    return null
  }
}

/**
 * 从当前请求的 `X-Forwarded-Host` / `Host` 推断站点 origin（CloudBase 未配 SITE_URL 时的兜底）。
 * 仅用于服务端 SEO 路由（robots / sitemap），勿在客户端调用。
 */
export async function getSiteUrlFromHeaders(): Promise<string | null> {
  const { headers } = await import('next/headers')
  const h = await headers()
  const xfProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()

  const xfHost = h.get('x-forwarded-host')
  if (xfHost) {
    const origin = originFromHostHeader(xfHost, xfProto)
    if (origin) return origin
  }

  const host = h.get('host')
  if (host) {
    const origin = originFromHostHeader(host, xfProto)
    if (origin) return origin
  }

  return null
}

/**
 * robots / sitemap 等 SEO 用站点根 URL。
 * 优先 `SITE_URL`；未配置时用当前请求域名，避免落到 Vercel 占位域名。
 */
export async function getSiteUrlForSeo(): Promise<string> {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    const normalized = tryNormalizeExplicitSiteUrl(explicit)
    if (normalized) return normalized
  }

  const fromHeaders = await getSiteUrlFromHeaders()
  if (fromHeaders) return fromHeaders

  return getSiteUrl()
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

  return SITE_URL_VERCEL_PLACEHOLDER
}

/** `getSiteUrl()` 的 URL 对象版，便于直接传给 Next `metadataBase`。 */
export function getSiteUrlObject(): URL {
  return new URL(getSiteUrl())
}
