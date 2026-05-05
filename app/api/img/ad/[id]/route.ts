import { NextResponse } from 'next/server'
import { neonGetAdBannerRawById } from '@/lib/neon/data'

/**
 * 广告 banner 代理：把 ad_placements.banner_url 中的 data: URL 解码为二进制，
 * http(s) 链接 308 跳转，其它返回 1×1 PNG。与 /api/img/tool/<id>/<kind> 同形。
 */
export const revalidate = 86400

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
)

function notFound(): NextResponse {
  return new NextResponse(ONE_PIXEL_PNG, {
    status: 404,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

function parseDataUrl(raw: string): { mime: string; bytes: Buffer } | null {
  const m = raw.match(/^data:([^;,]+)(;base64)?,(.*)$/)
  if (!m) return null
  const mime = m[1] || 'application/octet-stream'
  const isBase64 = !!m[2]
  const payload = m[3] ?? ''
  try {
    const bytes = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf-8')
    return { mime, bytes }
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const trimmedId = (id ?? '').trim()
  if (!trimmedId) return notFound()

  let raw: string | null = null
  try {
    raw = await neonGetAdBannerRawById(trimmedId)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ad img proxy] neon read failed:', e)
    }
    return notFound()
  }
  if (!raw) return notFound()

  if (raw.startsWith('data:')) {
    const parsed = parseDataUrl(raw)
    if (!parsed) return notFound()
    return new NextResponse(parsed.bytes, {
      status: 200,
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(parsed.bytes.length),
      },
    })
  }

  if (/^https?:\/\//i.test(raw)) {
    return NextResponse.redirect(raw, 308)
  }

  return notFound()
}
