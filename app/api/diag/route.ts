import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/neon/sql'

/**
 * 诊断 JSON 接口 —— 跟 `/diag` 同源，但返回纯 JSON。
 * 用来 curl 或者把整段输出贴给排查方，避免人工抄表。
 *
 * - 强制动态（不缓存任何结果）
 * - 中间件已豁免（middleware.ts 的 matcher 排除 `api/diag`）
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

type StepOk = { name: string; ok: true; ms: number; detail?: unknown }
type StepErr = { name: string; ok: false; ms: number; error: string }
type Step = StepOk | StepErr

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
  if (!u) return ''
  try {
    const parsed = new URL(u)
    return `${parsed.protocol}//${parsed.username ? '***@' : ''}${parsed.host}${parsed.pathname}`
  } catch {
    return '(invalid)'
  }
}

function neonRegion(host: string): string {
  const m = host.match(/\.([a-z0-9-]+)\.aws\.neon\.tech$/i)
  return m ? m[1] : ''
}

export async function GET() {
  const startedAt = Date.now()
  const dbUrl = process.env.DATABASE_URL?.trim() ?? ''
  let dbHost = ''
  try {
    dbHost = new URL(dbUrl).host
  } catch {}

  const steps: Step[] = []
  let getSqlError: string | null = null

  let sql: ReturnType<typeof getNeonSql> | null = null
  try {
    sql = getNeonSql()
  } catch (e) {
    getSqlError = e instanceof Error ? e.message : String(e)
  }

  if (sql) {
    const r1 = await timed('neon.now.cold', async () => {
      const rows = await sql!`SELECT NOW() AS now`
      return (rows[0] as { now?: unknown })?.now
    })
    steps.push(
      r1.step.ok ? { ...r1.step, detail: { now: String(r1.value) } } : r1.step,
    )

    const r2 = await timed('neon.select1.x3', async () => {
      const out: number[] = []
      for (let i = 0; i < 3; i++) {
        const t = performance.now()
        await sql!`SELECT 1`
        out.push(Math.round(performance.now() - t))
      }
      return out
    })
    steps.push(
      r2.step.ok ? { ...r2.step, detail: { each_ms: r2.value } } : r2.step,
    )

    const r3 = await timed('neon.tools.count', async () => {
      const rows = await sql!`SELECT count(*)::int AS n FROM tools`
      return (rows[0] as { n: number })?.n ?? null
    })
    steps.push(
      r3.step.ok ? { ...r3.step, detail: { count: r3.value } } : r3.step,
    )
  }

  const totalMs = Date.now() - startedAt

  return NextResponse.json(
    {
      ok: steps.every((s) => s.ok) && !getSqlError,
      total_ms: totalMs,
      env: {
        VERCEL_REGION: process.env.VERCEL_REGION ?? null,
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        VERCEL_URL: process.env.VERCEL_URL ?? null,
        NEXT_RUNTIME: process.env.NEXT_RUNTIME ?? 'nodejs',
        NODE_ENV: process.env.NODE_ENV ?? null,
        NEON_DRIVER: process.env.NEON_DRIVER ?? null,
      },
      database: {
        host: dbHost,
        region: neonRegion(dbHost),
        url: maskUrl(dbUrl),
      },
      get_sql_error: getSqlError,
      steps,
      hint: {
        cross_region:
          'VERCEL_REGION 与 database.region 不在同一物理区时，单次 SQL 多 150~300ms',
        cold_start:
          'Neon serverless 默认 5min 无活动会 suspend；首次唤醒约 1-2s，可在 Neon 控制台关闭 auto-suspend',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
}
