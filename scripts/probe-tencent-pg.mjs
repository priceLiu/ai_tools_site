#!/usr/bin/env node
/** 排查腾讯云 PG SSL/TLS 握手；穷举 4 种 SSL 配置，分别试 5s 超时 */
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function loadEnv() {
  const t = await fs.readFile(path.join(root, '.env.local'), 'utf8')
  for (const ln of t.split('\n')) {
    const m = ln.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*?)["']?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

async function probe(label, opts) {
  const { default: postgres } = await import('postgres')
  console.log(`\n--- ${label}`)
  const sql = postgres(process.env.TENCENT_DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
    ...opts,
  })
  try {
    const t0 = Date.now()
    const r = await sql`SELECT 1 as v, current_user as u, current_database() as db`
    const ms = Date.now() - t0
    console.log(`    ✓ ok in ${ms}ms`, r[0])
    await sql.end({ timeout: 2 })
    return true
  } catch (e) {
    console.log(`    ✗ ${e?.code || ''} ${e?.message || e}`)
    try { await sql.end({ timeout: 1 }) } catch {}
    return false
  }
}

async function main() {
  await loadEnv()
  if (!process.env.TENCENT_DATABASE_URL) {
    console.error('missing TENCENT_DATABASE_URL'); process.exit(1)
  }
  console.log('Target:', process.env.TENCENT_DATABASE_URL.replace(/(:\/\/[^:]+):[^@]+@/, '$1:****@'))

  /* 4 种 SSL 配置 */
  const configs = [
    ['ssl: false (无 SSL)', { ssl: false }],
    ['ssl: "prefer" (优先 SSL，失败回落)', { ssl: 'prefer' }],
    ['ssl: "require" (强制 SSL，验证证书)', { ssl: 'require' }],
    ['ssl: {rejectUnauthorized:false} (强制 SSL，跳过验证)', { ssl: { rejectUnauthorized: false } }],
  ]

  for (const [label, opts] of configs) {
    const ok = await probe(label, opts)
    if (ok) {
      console.log(`\n=== 找到可用配置: ${label}`)
      break
    }
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
