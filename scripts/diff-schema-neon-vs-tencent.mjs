#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 对比 Neon 与腾讯云 PG 的 schema 完整度。
 *
 * 用法：
 *   node scripts/diff-schema-neon-vs-tencent.mjs
 *
 * 读取 .env.local 里的：
 *   NEON_DATABASE_URL_BACKUP — Neon 公网串（迁移完成后留作参照源）
 *   TENCENT_DATABASE_URL    — 腾讯云 PG 公网串（迁移目标）
 *
 * 对比维度：
 *   1) 表 + 行数
 *   2) 表列（列名、is_nullable、column_default、data_type）
 *   3) trigger（tgname、event_manipulation、action_statement 摘要）
 *   4) function / procedure（proname、prokind）
 *   5) sequence
 *   6) extension
 *
 * 不写库，只读。
 *
 * 设计目的：迁移完成后做对账。CloudBase Run 上 /submit 报 view_count NOT NULL 23502 的根因
 * 就是腾讯 PG 上 `tools_seed_view_count_trigger` 漏装；以后任何 schema 漂移都能在这里一眼看到。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function loadDotEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  try {
    const text = await fs.readFile(envPath, 'utf8')
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    /** ok */
  }
}

await loadDotEnvLocal()

const NEON_URL =
  process.env.NEON_DATABASE_URL_BACKUP ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_NEON
const TENCENT_URL = process.env.TENCENT_DATABASE_URL || process.env.DATABASE_URL

if (!NEON_URL || !TENCENT_URL) {
  console.error(
    '需要在 .env.local 里同时配置 Neon（NEON_DATABASE_URL_BACKUP）与腾讯（TENCENT_DATABASE_URL）',
  )
  process.exit(2)
}

const neon = postgres(NEON_URL, { max: 2, prepare: false, ssl: 'require', connect_timeout: 30 })
const tencent = postgres(TENCENT_URL, {
  max: 2,
  prepare: false,
  ssl: TENCENT_URL.includes('sslmode=disable') ? false : 'require',
  connect_timeout: 30,
})

/** 把任意 SQL 在两端各跑一次，返回 { neon, tencent } 行数组 */
async function bothSides(label, sqlText) {
  const [n, t] = await Promise.all([
    neon.unsafe(sqlText).catch((e) => ({ __error: String(e) })),
    tencent.unsafe(sqlText).catch((e) => ({ __error: String(e) })),
  ])
  return { label, neon: n, tencent: t }
}

const SQL_TABLES_AND_COUNT = `
  SELECT table_schema || '.' || table_name AS qname
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`

const SQL_COLUMNS = `
  SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`

const SQL_TRIGGERS = `
  SELECT
    event_object_table AS table_name,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  ORDER BY event_object_table, trigger_name, event_manipulation
`

const SQL_FUNCTIONS = `
  SELECT
    n.nspname AS schema,
    p.proname AS name,
    pg_get_function_arguments(p.oid) AS args,
    CASE p.prokind
      WHEN 'f' THEN 'function'
      WHEN 'p' THEN 'procedure'
      WHEN 'a' THEN 'aggregate'
      WHEN 'w' THEN 'window'
    END AS kind
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY p.proname, args
`

const SQL_SEQUENCES = `
  SELECT sequence_name FROM information_schema.sequences
  WHERE sequence_schema = 'public'
  ORDER BY sequence_name
`

const SQL_EXTENSIONS = `
  SELECT extname FROM pg_extension ORDER BY extname
`

function asMap(rows, keyFn) {
  const m = new Map()
  if (!Array.isArray(rows)) return m
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, r)
  }
  return m
}

function diffSets(neonRows, tencentRows, keyFn, label) {
  if (neonRows && neonRows.__error) {
    console.log(`  ⚠️ Neon 查询失败: ${neonRows.__error}`)
    return
  }
  if (tencentRows && tencentRows.__error) {
    console.log(`  ⚠️ 腾讯查询失败: ${tencentRows.__error}`)
    return
  }
  const nm = asMap(neonRows, keyFn)
  const tm = asMap(tencentRows, keyFn)
  const onlyNeon = []
  const onlyTencent = []
  for (const k of nm.keys()) if (!tm.has(k)) onlyNeon.push(k)
  for (const k of tm.keys()) if (!nm.has(k)) onlyTencent.push(k)
  if (onlyNeon.length === 0 && onlyTencent.length === 0) {
    console.log(`  ✅ ${label} 一致（${nm.size} 项）`)
    return
  }
  if (onlyNeon.length) {
    console.log(`  ❌ ${label} 仅 Neon 有（${onlyNeon.length} 项 — 这就是腾讯 PG 漏装的）：`)
    for (const k of onlyNeon.slice(0, 30)) console.log(`     - ${k}`)
    if (onlyNeon.length > 30) console.log(`     ... 以及另外 ${onlyNeon.length - 30} 项`)
  }
  if (onlyTencent.length) {
    console.log(`  ⚠️ ${label} 仅腾讯有（${onlyTencent.length} 项 — 通常是迁移过程中创建的）：`)
    for (const k of onlyTencent.slice(0, 30)) console.log(`     - ${k}`)
    if (onlyTencent.length > 30) console.log(`     ... 以及另外 ${onlyTencent.length - 30} 项`)
  }
}

async function main() {
  console.log('=== Neon vs 腾讯云 PG schema 对账 ===\n')

  // 1) 表
  console.log('[1/6] 表对比')
  {
    const r = await bothSides('tables', SQL_TABLES_AND_COUNT)
    diffSets(r.neon, r.tencent, (x) => x.qname, '表')
  }

  // 2) 表列（NOT NULL / default 是这次问题的根源）
  console.log('\n[2/6] 列定义对比（含 NOT NULL / DEFAULT；最关心 column_default）')
  {
    const r = await bothSides('columns', SQL_COLUMNS)
    diffSets(
      r.neon,
      r.tencent,
      (x) => `${x.table_name}.${x.column_name} | type=${x.data_type} | nullable=${x.is_nullable} | default=${x.column_default ?? ''}`,
      '列签名',
    )
  }

  // 3) trigger（这次 view_count 23502 的真正根因）
  console.log('\n[3/6] Trigger 对比（漏装会导致 INSERT/UPDATE 失败）')
  {
    const r = await bothSides('triggers', SQL_TRIGGERS)
    diffSets(
      r.neon,
      r.tencent,
      (x) => `${x.table_name} | ${x.trigger_name} | ${x.action_timing} ${x.event_manipulation}`,
      'trigger',
    )
  }

  // 4) function
  console.log('\n[4/6] Function / Procedure 对比')
  {
    const r = await bothSides('functions', SQL_FUNCTIONS)
    diffSets(r.neon, r.tencent, (x) => `${x.kind} | ${x.name}(${x.args})`, 'function')
  }

  // 5) sequence
  console.log('\n[5/6] Sequence 对比')
  {
    const r = await bothSides('sequences', SQL_SEQUENCES)
    diffSets(r.neon, r.tencent, (x) => x.sequence_name, 'sequence')
  }

  // 6) extension
  console.log('\n[6/6] Extension 对比')
  {
    const r = await bothSides('extensions', SQL_EXTENSIONS)
    diffSets(r.neon, r.tencent, (x) => x.extname, 'extension')
  }

  console.log('\n=== 对账完成 ===')
  await Promise.all([neon.end(), tencent.end()])
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
