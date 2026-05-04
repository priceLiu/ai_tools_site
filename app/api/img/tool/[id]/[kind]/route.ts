import { NextResponse } from 'next/server'
import { neonGetToolImageRawById } from '@/lib/neon/data'

/**
 * 工具图片代理：把数据库里的 `data:image/...;base64,...` 解码为二进制返回，并加长缓存头。
 * 外部 `http(s)` URL 走原始链接（前端不会经过这里），故此处仅处理 data URL；
 * 其它情况一律 404。
 *
 * 缓存：URL 含 `?v=<updated_at>`，更新后 URL 变化天然失效；本响应使用 `immutable` 长缓存。
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
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await context.params
  if (kind !== 'logo' && kind !== 'screenshot') {
    return notFound()
  }
  const trimmedId = (id ?? '').trim()
  if (!trimmedId) return notFound()

  let raw: string | null = null
  try {
    raw = await neonGetToolImageRawById(trimmedId, kind)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[img proxy] neon read failed:', e)
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
