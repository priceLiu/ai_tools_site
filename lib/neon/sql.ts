import { neon } from '@neondatabase/serverless'
import postgres from 'postgres'

export type NeonRow = Record<string, unknown>

type SqlTaggedFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<NeonRow[]>

let sqlTaggedTcp: SqlTaggedFn | null = null
let sqlTaggedHttp: SqlTaggedFn | null = null

function usePostgresTcp(): boolean {
  const d = process.env.NEON_DRIVER?.trim().toLowerCase() ?? ''
  if (d === 'http' || d === 'serverless' || d === 'fetch' || d === 'neon') {
    return false
  }
  if (d === 'postgres' || d === 'tcp') {
    return true
  }
  /** 未设置时：本地 dev 默认 TCP，避免 `@neondatabase/serverless` 在本机报错 fetch failed。 */
  return process.env.NODE_ENV === 'development'
}

/** Next.js middleware 始终在 Edge 运行，不能使用 Node 的 `net`，TCP 驱动会报错。 */
function isNextEdgeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === 'edge'
}

function formatNeonConnectErr(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const parts: string[] = [err.message]
  let c: unknown = (err as Error & { cause?: unknown }).cause
  let depth = 0
  while (c != null && depth < 5) {
    if (c instanceof Error) {
      parts.push(c.message)
      c = (c as Error & { cause?: unknown }).cause
    } else {
      parts.push(String(c))
      break
    }
    depth += 1
  }
  return parts.filter(Boolean).join(' → ')
}

/** 是否为网络/传输层问题；业务层 SQL 报错应原样抛出，避免误标成「连接失败」。 */
function isProbablyTransportFailure(text: string): boolean {
  return /ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|connect|fetch failed|NeonDbError|TLS|certificate|channel_binding|socket|ECONNABORTED/i.test(
    text,
  )
}

/**
 * Tagged template；结果统一为行数组，便于 TypeScript 推断。
 *
 * HTTP 与 TCP 各维护一份客户端，避免同一 Node 进程内因环境问题先选了一种驱动就钉死。
 *
 * 默认：生产环境用 `@neondatabase/serverless`（HTTPS fetch）；**开发环境未设置 NEON_DRIVER 时默认 TCP**。
 * 显式 `NEON_DRIVER=postgres|tcp`：Node 走 TCP；`NEON_DRIVER=http|serverless|fetch|neon`：强制 HTTPS。
 * **Middleware 固定在 Edge**，`NEXT_RUNTIME === 'edge'` 时始终用 serverless。
 * 同一 `DATABASE_URL`；若 `channel_binding=require` 在 TCP 下报错可去掉该参数试一次。
 */
export function getNeonSql() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  const preferTcp = usePostgresTcp() && !isNextEdgeRuntime()

  if (preferTcp) {
    if (!sqlTaggedTcp) {
      const client = postgres(url, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 60,
      })
      sqlTaggedTcp = async (strings, ...values) => {
        try {
          const rows = await client(strings, ...(values as never[]))
          return rows as NeonRow[]
        } catch (e) {
          const chain = formatNeonConnectErr(e)
          if (!isProbablyTransportFailure(chain)) {
            throw e
          }
          throw new Error(
            [
              'Neon（TCP / postgres 驱动）连接失败。',
              `详情: ${chain}`,
              '请检查 DATABASE_URL、本机网络；连接串若含 channel_binding=require 可去掉重试；不需要 TCP 时删除环境变量 NEON_DRIVER。',
            ].join(' '),
            { cause: e },
          )
        }
      }
    }
    return sqlTaggedTcp
  }

  if (!sqlTaggedHttp) {
    const raw = neon(url)
    sqlTaggedHttp = async (strings, ...values) => {
      try {
        return (await raw(strings, ...values)) as NeonRow[]
      } catch (e) {
        const chain = formatNeonConnectErr(e)
        const isFetchFail =
          e instanceof Error &&
          /fetch failed|NeonDbError/i.test(e.message + chain)
        if (isFetchFail) {
          throw new Error(
            [
              'Neon: 无法通过 HTTPS 连上数据库（@neondatabase/serverless 使用 fetch，不走本机 TCP）。',
              `详情: ${chain}`,
              '请检查：1) Neon 项目是否 Active 2) DATABASE_URL 是否正确 3) VPN/代理 4) Pooler / Direct 另一套 host。',
              '若仅本地 dev 失败：在 `.env.local` 增加 NEON_DRIVER=postgres 可走 TCP（需已执行 pnpm install）。',
            ].join(' '),
            { cause: e },
          )
        }
        throw e
      }
    }
  }
  return sqlTaggedHttp
}
