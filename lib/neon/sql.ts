import postgres from 'postgres'

export type NeonRow = Record<string, unknown>

type SqlTaggedFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<NeonRow[]>

let pgClient: ReturnType<typeof postgres> | null = null
let sqlTagged: SqlTaggedFn | null = null

function formatConnectErr(err: unknown): string {
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
  return /ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|connect|fetch failed|TLS|certificate|channel_binding|socket|ECONNABORTED/i.test(
    text,
  )
}

function wrapSqlTagged(
  run: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => PromiseLike<any>,
): SqlTaggedFn {
  return async (strings, ...values) => {
    try {
      const rows = await run(strings, ...(values as never[]))
      return rows as NeonRow[]
    } catch (e) {
      const chain = formatConnectErr(e)
      if (!isProbablyTransportFailure(chain)) {
        throw e
      }
      throw new Error(
        [
          '数据库连接失败（postgres TCP）。',
          `详情: ${chain}`,
          '排查：1) DATABASE_URL 是否正确（VPC 内网串 / 公网串） 2) 安全组是否放行 5432 端口 3) sslmode=require 是否携带',
        ].join(' '),
        { cause: e },
      )
    }
  }
}

function ensurePgClient(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  if (!pgClient) {
    pgClient = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 60,
      /** 复杂迁移 / Server Actions 偶有多语句，关闭 prepared statement 更稳。 */
      prepare: false,
    })
  }
  return pgClient
}

/**
 * 在单连接事务中执行回调（postgres.js 要求：勿手写 BEGIN/COMMIT 分散占用连接池）。
 * 回调成功则提交，抛错则回滚。
 */
export async function neonSqlBegin<T>(fn: (sql: SqlTaggedFn) => Promise<T>): Promise<T> {
  const sql = ensurePgClient()
  const out = await sql.begin(async (tx) => {
    const txSql: SqlTaggedFn = async (strings, ...values) => {
      const rows = await tx(strings, ...(values as never[]))
      return rows as NeonRow[]
    }
    return fn(txSql)
  })
  return out as T
}

/**
 * 数据库 tagged template 客户端。
 *
 * 历史背景：曾经为 Neon 提供 HTTP（`@neondatabase/serverless`）+ TCP（`postgres`）
 * 双驱动，因为 Vercel/Edge 上 TCP 不可用。
 * 2026-05-06 迁移到腾讯云 TDSQL-C PostgreSQL（VPC 内网，CloudBase Run 上 Node 长进程），
 * 不再需要 HTTP fetch 驱动；统一走 `postgres` TCP，连接复用更稳。
 *
 * 模块路径仍叫 `lib/neon/sql.ts` 是为了保留 60+ 个文件的 import 路径不动。
 * 后续若整体改名 `lib/db/`，再批量替换。
 */
export function getNeonSql() {
  const client = ensurePgClient()
  if (!sqlTagged) {
    sqlTagged = wrapSqlTagged((strings, ...values) =>
      client(strings, ...(values as never[])),
    )
  }
  return sqlTagged
}
