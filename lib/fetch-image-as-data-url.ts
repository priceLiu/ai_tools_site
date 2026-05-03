const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 25_000

function guessMimeFromUrl(url: string, headerType: string | null): string {
  const ct = (headerType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (ct.startsWith('image/')) return ct
  const lower = url.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  return 'image/png'
}

/**
 * 下载图片并转为 data URL（存入 logo_url）。
 * favicon 等可能返回 octet-stream，按 URL/首部尽力推断 MIME。
 */
export async function fetchImageAsDataUrl(
  imageUrl: string,
): Promise<{ dataUrl: string } | { error: string }> {
  const u = imageUrl.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return { error: '仅支持 http(s) 图片地址' }
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(u, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'AI-Toolset-AdminImport/1.0',
        Accept: 'image/*,*/*;q=0.8',
      },
    })
    if (!res.ok) {
      return { error: `HTTP ${res.status}` }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return { error: '空响应' }
    if (buf.length > MAX_BYTES) {
      return { error: `超过 ${MAX_BYTES} 字节上限` }
    }
    const mime = guessMimeFromUrl(u, res.headers.get('content-type'))
    const b64 = buf.toString('base64')
    return { dataUrl: `data:${mime};base64,${b64}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg.includes('abort') ? '下载超时' : msg }
  } finally {
    clearTimeout(timer)
  }
}
