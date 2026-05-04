import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'

/**
 * Echo 页：把请求落到 Vercel 边缘后能拿到的关键 header 全部回显出来。
 * 用途：当手机端打不开主站时，先打开 `/echo`：
 *   - 能打开 → 至少链路是通的，看上面的 IP / Edge / Country 判断走的哪条出口；
 *   - 打不开 → 根本没穿过运营商，问题在域名 / DNS / 运营商封锁，跟代码无关。
 *
 * 所有数据来自 Vercel 注入的 request header；不查任何 DB、不挂任何客户端组件。
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Echo · 链路诊断',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8b5cf6',
}

/** `x-vercel-id` 形如 `sin1::iad1::abcd-1234-...`，第一段就是处理本次请求的边缘节点。 */
function parseVercelEdge(id: string | null): {
  edge: string
  region: string
  raw: string
} {
  if (!id) return { edge: '-', region: '-', raw: '-' }
  const parts = id.split('::')
  return {
    edge: parts[0] ?? '-',
    region: parts[1] ?? '-',
    raw: id,
  }
}

const VERCEL_EDGE_LABELS: Record<string, string> = {
  sin1: '🇸🇬 新加坡',
  hkg1: '🇭🇰 香港',
  hnd1: '🇯🇵 东京',
  icn1: '🇰🇷 首尔',
  bom1: '🇮🇳 孟买',
  syd1: '🇦🇺 悉尼',
  iad1: '🇺🇸 弗吉尼亚（美东）',
  cle1: '🇺🇸 克利夫兰',
  sfo1: '🇺🇸 旧金山（美西）',
  pdx1: '🇺🇸 波特兰',
  cdg1: '🇫🇷 巴黎',
  fra1: '🇩🇪 法兰克福',
  arn1: '🇸🇪 斯德哥尔摩',
  lhr1: '🇬🇧 伦敦',
  dub1: '🇮🇪 都柏林',
  gru1: '🇧🇷 圣保罗',
}

function describeEdge(code: string): string {
  return VERCEL_EDGE_LABELS[code] ?? code
}

export default async function EchoPage() {
  const h = await headers()
  const now = new Date()

  const xff = h.get('x-forwarded-for') ?? ''
  const realIp = h.get('x-real-ip') ?? ''
  const clientIp =
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    xff.split(',')[0]?.trim() ||
    realIp ||
    '-'

  const ua = h.get('user-agent') ?? '-'
  const isMobile = /\b(iPhone|Android|iPad|Mobile)\b/i.test(ua)

  const country = h.get('x-vercel-ip-country') ?? '-'
  const region = h.get('x-vercel-ip-country-region') ?? '-'
  const city =
    decodeURIComponent(h.get('x-vercel-ip-city') ?? '') || '-'
  const tz = h.get('x-vercel-ip-timezone') ?? '-'
  const lat = h.get('x-vercel-ip-latitude') ?? ''
  const lon = h.get('x-vercel-ip-longitude') ?? ''

  const edgeInfo = parseVercelEdge(h.get('x-vercel-id'))

  const protocol = h.get('x-forwarded-proto') ?? '-'
  const host = h.get('host') ?? '-'
  const accept = h.get('accept') ?? '-'
  const acceptLang = h.get('accept-language') ?? '-'
  const acceptEnc = h.get('accept-encoding') ?? '-'
  const referer = h.get('referer') ?? '(none)'
  const cfRay = h.get('cf-ray') ?? null
  const cfConnectingIp = h.get('cf-connecting-ip') ?? null
  const viaCloudflare = !!cfRay || !!cfConnectingIp

  const allHeaders: [string, string][] = []
  h.forEach((value, key) => {
    allHeaders.push([key, value])
  })
  allHeaders.sort((a, b) => a[0].localeCompare(b[0]))

  const verdict = (() => {
    const items: { ok: boolean; text: string }[] = []
    if (edgeInfo.edge !== '-') {
      items.push({
        ok: true,
        text: `请求已到达 Vercel 边缘节点（${describeEdge(edgeInfo.edge)}），网络层完全打通。`,
      })
    } else {
      items.push({
        ok: false,
        text: '没有看到 Vercel edge 标识；请求可能没真正经过 Vercel，或者被中间代理改写过 header。',
      })
    }
    if (country === 'CN') {
      items.push({
        ok: true,
        text: `Vercel 判定你来自 🇨🇳 中国大陆${city !== '-' ? `（${city}）` : ''}。`,
      })
    } else if (country !== '-') {
      items.push({
        ok: false,
        text: `Vercel 判定你来自 ${country}${city !== '-' ? `（${city}）` : ''} —— 多半你这条链路走了 VPN / 海外出口。`,
      })
    }
    if (viaCloudflare) {
      items.push({
        ok: true,
        text: '请求经过了 Cloudflare 代理（看到 cf-ray / cf-connecting-ip）。',
      })
    }
    return items
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
        <h1 className="text-base font-semibold md:text-lg">Echo · 链路诊断</h1>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          {now.toISOString()} · 服务端实时回显，每次刷新都是新的
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 md:px-6 md:py-7">
        {/* 关键结论 */}
        <section className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 shadow-sm md:p-5">
          <h2 className="mb-3 text-sm font-semibold md:text-base">
            🎯 这次请求做到了…
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed">
            {verdict.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{v.ok ? '✅' : '⚠️'}</span>
                <span className="text-foreground/90">{v.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 客户端 / 出口 */}
        <Section title="🛰 你（客户端）">
          <KV k="客户端 IP" v={clientIp} mono />
          <KV k="是否移动端 UA" v={isMobile ? '是' : '否'} highlight />
          <KV k="国家 / 地区" v={country} />
          <KV
            k="城市 / 省"
            v={city === '-' ? region : `${city} / ${region}`}
          />
          <KV k="时区" v={tz} />
          {(lat || lon) && (
            <KV k="经纬度（粗略）" v={`${lat}, ${lon}`} mono />
          )}
        </Section>

        {/* Vercel 边缘 */}
        <Section title="🌐 Vercel 边缘节点">
          <KV
            k="处理本次请求的 Edge"
            v={describeEdge(edgeInfo.edge)}
            highlight
          />
          <KV k="x-vercel-id (raw)" v={edgeInfo.raw} mono />
          <KV k="协议" v={protocol} />
          <KV k="Host" v={host} mono />
          {viaCloudflare && (
            <>
              <KV k="cf-ray" v={cfRay ?? '-'} mono />
              <KV k="cf-connecting-ip" v={cfConnectingIp ?? '-'} mono />
            </>
          )}
        </Section>

        {/* 浏览器声明 */}
        <Section title="📱 浏览器声明">
          <KV k="User-Agent" v={ua} mono />
          <KV k="Accept" v={accept} mono />
          <KV k="Accept-Language" v={acceptLang} mono />
          <KV k="Accept-Encoding" v={acceptEnc} mono />
          <KV k="Referer" v={referer} mono />
        </Section>

        {/* 全量 header */}
        <Section title="📋 全量请求头（折叠在 details 里）">
          <details>
            <summary className="cursor-pointer text-sm text-primary">
              展开 {allHeaders.length} 行
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
              {allHeaders
                .map(
                  ([k, v]) =>
                    `${k.padEnd(28)} ${
                      /authorization|cookie|secret|token/i.test(k)
                        ? '***'
                        : v
                    }`,
                )
                .join('\n')}
            </pre>
          </details>
        </Section>

        <Section title="💡 怎么用">
          <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-foreground">手机能打开本页</b> →
              说明域名 / 网络通到 Vercel 没问题。看上面「
              <code className="mx-1 rounded bg-muted px-1">
                处理本次请求的 Edge
              </code>
              」是哪个城市；如果跟你的物理位置差很多（比如手机在国内但落到{' '}
              <code className="mx-1 rounded bg-muted px-1">sfo1</code>），
              说明你装了 VPN 或者运营商把流量绕到了海外。
            </li>
            <li>
              <b className="text-foreground">手机打不开本页</b> →
              请求根本没穿过运营商，跟代码、Next.js、Neon 全无关，是
              <code className="mx-1 rounded bg-muted px-1">*.vercel.app</code>{' '}
              域名在国内移动网被封锁。<b>必须换自定义域名</b>（最好套
              Cloudflare），见 <code>deploy.md</code> 第十一节。
            </li>
            <li>
              <b className="text-foreground">PC 能开 / 手机不能开</b> →
              基本必然是上一条。可以通过 PC 浏览器把本页 URL 用二维码扫到手机
              4G 网下二次验证。
            </li>
          </ul>
        </Section>
      </main>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <h2 className="mb-3 text-sm font-semibold md:text-base">{title}</h2>
      {children}
    </section>
  )
}

function KV({
  k,
  v,
  mono,
  highlight,
}: {
  k: string
  v: string | number
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2 text-sm last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span
        className={[
          'break-all sm:max-w-[60%] sm:text-right',
          mono ? 'font-mono text-xs sm:text-sm' : '',
          highlight ? 'font-semibold text-foreground' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {String(v)}
      </span>
    </div>
  )
}
