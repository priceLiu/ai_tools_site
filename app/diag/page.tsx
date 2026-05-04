import type { Metadata, Viewport } from 'next'
import { getNeonSql } from '@/lib/neon/sql'
import { getHomeToolBundle } from '@/lib/cached-home-data'

/**
 * 诊断页：手机也能直接打开 `/diag`，看到 Vercel region / Neon 延迟 / 首页 bundle 大小，
 * 用来定位「公网移动端打不开」到底是网络、DB 区域错位，还是首屏 payload 过大。
 *
 * - 强制动态（永远新鲜测一次）
 * - 不缓存（绕开 Next Data Cache、不加任何长 TTL 头）
 * - 中间件已豁免（middleware.ts 的 matcher 排除 `diag`）
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: '诊断 · /diag',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8b5cf6',
}

type Step =
  | { name: string; ok: true; ms: number; detail?: string }
  | { name: string; ok: false; ms: number; error: string }

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ step: Step; value: T | null }> {
  const t0 = performance.now()
  try {
    const value = await fn()
    return {
      step: { name, ok: true, ms: Math.round(performance.now() - t0) },
      value,
    }
  } catch (e) {
    return {
      step: {
        name,
        ok: false,
        ms: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      },
      value: null,
    }
  }
}

function maskUrl(u: string | undefined): string {
  if (!u) return '-'
  try {
    const parsed = new URL(u)
    const host = parsed.host
    const user = parsed.username ? '***' : ''
    return `${parsed.protocol}//${user}${user ? '@' : ''}${host}${parsed.pathname}`
  } catch {
    return '(invalid)'
  }
}

function neonRegionHint(host: string): string {
  /** Neon host 形如 `ep-foo-123-pooler.ap-southeast-1.aws.neon.tech`；中间段就是 region。 */
  const m = host.match(/\.([a-z0-9-]+)\.aws\.neon\.tech$/i)
  if (m) return m[1]
  return '(unknown)'
}

function vercelRegionHint(): string {
  /**
   * Vercel 在 serverless function 内会把执行 region 暴露在 `process.env.VERCEL_REGION`
   * （形如 `sin1`、`hkg1`、`hnd1`、`iad1` 等）。
   */
  return process.env.VERCEL_REGION || '(local / not on vercel)'
}

function regionMatch(neon: string, vercel: string): string {
  if (vercel === '(local / not on vercel)' || neon === '(unknown)') return '-'
  const tablesNear: Record<string, string[]> = {
    sin1: ['ap-southeast-1', 'ap-southeast-2', 'ap-east-1'],
    hkg1: ['ap-east-1', 'ap-southeast-1'],
    hnd1: ['ap-northeast-1'],
    icn1: ['ap-northeast-2'],
    bom1: ['ap-south-1'],
    iad1: ['us-east-1', 'us-east-2'],
    sfo1: ['us-west-1', 'us-west-2'],
    cdg1: ['eu-west-1', 'eu-west-3', 'eu-central-1'],
    fra1: ['eu-central-1', 'eu-west-1'],
  }
  const list = tablesNear[vercel]
  if (!list) return '?'
  return list.includes(neon) ? '✅ 同区/邻近' : '⚠️ 跨区，单次往返 150-300ms'
}

export default async function DiagPage() {
  const startedAt = Date.now()

  const dbUrl = process.env.DATABASE_URL?.trim() ?? ''
  let dbHost = ''
  try {
    dbHost = new URL(dbUrl).host
  } catch {}
  const neonRegion = neonRegionHint(dbHost)
  const vercelRegion = vercelRegionHint()

  const sql = (() => {
    try {
      return getNeonSql()
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  })()

  const steps: Step[] = []

  if (typeof sql === 'function') {
    /** 1) 最轻量：单次 NOW()，纯连通性 + RTT */
    const r1 = await timed('Neon: SELECT NOW() ×1', async () => {
      const rows = await sql`SELECT NOW() AS now`
      return (rows[0] as { now?: unknown })?.now
    })
    steps.push(
      r1.step.ok
        ? { ...r1.step, detail: `server now = ${String(r1.value)}` }
        : r1.step,
    )

    /** 2) 连续 3 次 NOW()，看是否冷启动只第一次慢 */
    const r2 = await timed('Neon: SELECT NOW() ×3 (顺序)', async () => {
      const out: number[] = []
      for (let i = 0; i < 3; i++) {
        const t = performance.now()
        await sql`SELECT 1`
        out.push(Math.round(performance.now() - t))
      }
      return out
    })
    steps.push(
      r2.step.ok
        ? { ...r2.step, detail: `逐次耗时 ms: [${(r2.value ?? []).join(', ')}]` }
        : r2.step,
    )

    /** 3) tools 计数（业务表 + 索引也跑一次） */
    const r3 = await timed('Neon: SELECT count(*) FROM tools', async () => {
      const rows = await sql`SELECT count(*)::int AS n FROM tools`
      return (rows[0] as { n: number })?.n
    })
    steps.push(
      r3.step.ok
        ? { ...r3.step, detail: `tools 行数 = ${String(r3.value)}` }
        : r3.step,
    )
  } else {
    steps.push({
      name: 'Neon: getNeonSql()',
      ok: false,
      ms: 0,
      error: sql,
    })
  }

  /** 4) 首页 bundle（端到端，包含快照 + ISR cache） */
  const r4 = await timed('getHomeToolBundle()', async () => {
    const b = await getHomeToolBundle()
    const json = JSON.stringify(b)
    return {
      featured: b.featured.length,
      latest: b.latest.length,
      sections: b.homeCategoryBlocks.length,
      bytes: json.length,
    }
  })
  steps.push(
    r4.step.ok && r4.value
      ? {
          ...r4.step,
          detail: `featured=${r4.value.featured}, latest=${r4.value.latest}, sections=${r4.value.sections}, bundleJSON=${(r4.value.bytes / 1024).toFixed(1)}KB`,
        }
      : r4.step,
  )

  const totalMs = Date.now() - startedAt

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
        <h1 className="text-base font-semibold md:text-lg">诊断 · /diag</h1>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          全部由服务端测算 · 总耗时 {totalMs}ms · 不会出现在搜索引擎
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 md:px-6 md:py-7">
        <Section title="🌍 Region 对位">
          <KV k="Vercel function region" v={vercelRegion} />
          <KV k="Neon db host" v={dbHost || '(missing DATABASE_URL)'} />
          <KV k="Neon region" v={neonRegion} />
          <KV
            k="是否同区"
            v={regionMatch(neonRegion, vercelRegion)}
            highlight
          />
        </Section>

        <Section title="⚡ DB 连通 / 延迟">
          <ul className="divide-y divide-border/60">
            {steps.map((s) => (
              <li
                key={s.name}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="mr-1.5">{s.ok ? '✅' : '❌'}</span>
                    {s.name}
                  </p>
                  {s.ok ? (
                    s.detail ? (
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {s.detail}
                      </p>
                    ) : null
                  ) : (
                    <p className="mt-0.5 break-words text-xs text-destructive">
                      {s.error}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
                  {s.ms} ms
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="🛠 运行环境">
          <KV k="NEXT_RUNTIME" v={process.env.NEXT_RUNTIME || 'nodejs'} />
          <KV k="NODE_ENV" v={process.env.NODE_ENV || ''} />
          <KV
            k="VERCEL_URL"
            v={process.env.VERCEL_URL || '(not on vercel)'}
          />
          <KV
            k="VERCEL_ENV"
            v={process.env.VERCEL_ENV || '(not on vercel)'}
          />
          <KV k="NEON_DRIVER" v={process.env.NEON_DRIVER || '(default)'} />
          <KV k="DATABASE_URL" v={maskUrl(dbUrl)} mono />
        </Section>

        <Section title="💡 解读 / 建议">
          <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-foreground">每次 NOW()&gt; 200ms</b>
              ：函数与 DB 跨区，是公网慢的主因。把 Vercel function region 调到
              和 Neon 同区（你 Neon 在
              <code className="mx-1 rounded bg-muted px-1">{neonRegion}</code>
              ，对应 Vercel 应选
              <code className="mx-1 rounded bg-muted px-1">sin1</code>）。
            </li>
            <li>
              <b className="text-foreground">3 次顺序 NOW() 第一次远高于后两次</b>
              ：纯冷启动；Neon serverless 自动 suspend 后首次连接需要唤醒（约 1-2s）。
              可以在 Neon 项目设置里把 auto-suspend 关掉或拉长。
            </li>
            <li>
              <b className="text-foreground">getHomeToolBundle&gt; 500ms</b>
              ：首页快照不存在/已失效；去 /admin 点一次「生成静态」。
            </li>
            <li>
              <b className="text-foreground">bundleJSON&gt; 200KB</b>
              ：首页 HTML 还是偏大，需要再裁剪图片/字段。当前
              <code className="mx-1 rounded bg-muted px-1">/api/img</code> 已绕开 JWT 中间件。
            </li>
            <li>
              <b className="text-foreground">所有 Neon 步骤都 ❌</b>
              ：不是性能问题，而是连接挂了；看 Neon 项目是否 Active、
              <code className="mx-1 rounded bg-muted px-1">DATABASE_URL</code>{' '}
              在 Vercel 里是否真正生效。
            </li>
          </ul>
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          页面强制动态，每次刷新都重新测；&nbsp; 若手机上加载这一页都很慢，
          说明问题主要发生在 函数→Neon 这一段。
        </p>
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
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2 text-sm last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={[
          'break-all sm:text-right',
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
