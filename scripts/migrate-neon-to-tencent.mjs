#!/usr/bin/env node
/**
 * 从 Neon 迁移到腾讯云 PostgreSQL（纯 Node 实现，不依赖 pg_dump / psql）。
 *
 * 用法（项目根）：
 *   1. 在 .env.local 里配齐：
 *        DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
 *        TENCENT_DATABASE_URL=postgresql://aitools_admin:PWD@sh-postgres-xxx.sql.tencentcdb.com:24155/aitools?sslmode=require
 *   2. node scripts/migrate-neon-to-tencent.mjs
 *
 * 流程：
 *   [1] 双端连通性测试
 *   [2] 在腾讯云目标库按文件名顺序应用 supabase/migrations/*.sql（跳过 storage.* 迁移）
 *   [3] 通过 information_schema 发现表清单 + FK 依赖
 *   [4] 反依赖顺序 DELETE 目标表（保留 schema、清空 seed 数据）
 *   [5] 按依赖顺序从 Neon SELECT * → 批量 INSERT 到腾讯
 *       —— 自引用 FK 列两阶段：先置 NULL，全表插入完后再 UPDATE 回填
 *   [6] 行数对比报告
 *
 * 幂等：可重复执行；失败可单独再跑。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/* --- 跳过 Supabase Storage 相关迁移（纯 Neon/Tencent 不需要） --- */
const STORAGE_SKIP = new Set([
  '20260502200000_storage_tool_uploads.sql',
  '20260502270000_site_public_cache_bucket.sql',
])

const BATCH_SIZE = 200

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

function mask(u) {
  return u.replace(/(:\/\/[^:]+):[^@]+@/, '$1:****@')
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"'
}

function topoSort(nodes, edges) {
  const inDeg = new Map(nodes.map((n) => [n, 0]))
  const adj = new Map(nodes.map((n) => [n, []]))
  for (const [from, to] of edges) {
    if (!inDeg.has(to) || !adj.has(from)) continue
    inDeg.set(to, inDeg.get(to) + 1)
    adj.get(from).push(to)
  }
  const queue = nodes.filter((n) => inDeg.get(n) === 0)
  const result = []
  while (queue.length) {
    const n = queue.shift()
    result.push(n)
    for (const m of adj.get(n) || []) {
      inDeg.set(m, inDeg.get(m) - 1)
      if (inDeg.get(m) === 0) queue.push(m)
    }
  }
  if (result.length !== nodes.length) {
    /** 兜底：检测到环，把剩余节点直接追加 */
    const set = new Set(result)
    for (const n of nodes) if (!set.has(n)) result.push(n)
  }
  return result
}

async function main() {
  await loadDotEnvLocal()

  const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
  const TENCENT_URL = process.env.TENCENT_DATABASE_URL
  const SKIP_SCHEMA = process.argv.includes('--skip-schema')
  const DATA_ONLY = process.argv.includes('--data-only')
  const CHECK_ONLY = process.argv.includes('--check')

  if (!NEON_URL) throw new Error('未设置 NEON_DATABASE_URL 或 DATABASE_URL（.env.local）')
  if (!TENCENT_URL) throw new Error('未设置 TENCENT_DATABASE_URL（.env.local）')

  console.log('=== Neon → 腾讯云 PG 全量迁移')
  console.log('  Source(Neon):     ', mask(NEON_URL))
  console.log('  Target(Tencent):  ', mask(TENCENT_URL))
  console.log('')

  const { default: postgres } = await import('postgres')
  const src = postgres(NEON_URL, { ssl: 'require', max: 4, prepare: false })
  /** 腾讯云 PG 默认未开 SSL；URL 里 sslmode=disable 已设置，这里也显式 false */
  const dst = postgres(TENCENT_URL, {
    ssl: false,
    max: 2,
    prepare: false,
    connect_timeout: 15,
  })

  try {
    /* ============================================================
       [1/6] 连通性
    ============================================================ */
    console.log('=== [1/6] 连通性测试')
    const [srcVer] = await src`SELECT version() AS v`
    console.log('  Neon ✓     ', srcVer.v.slice(0, 70))
    const [dstVer] = await dst`SELECT version() AS v`
    console.log('  Tencent ✓  ', dstVer.v.slice(0, 70))
    console.log('')

    if (CHECK_ONLY) {
      console.log('=== --check 完成（仅连通性测试），未触动任何数据')
      return
    }

    /* 让所有后续 dst 查询默认 public schema */
    await dst.unsafe('SET search_path = public')

    /* ============================================================
       [2/6] 应用 schema 迁移到 Tencent
    ============================================================ */
    if (SKIP_SCHEMA || DATA_ONLY) {
      console.log('=== [2/6] 跳过 schema 迁移（--skip-schema / --data-only）')
    } else {
      console.log('=== [2/6] 应用 schema 迁移到腾讯云')
      const migrationsDir = path.join(projectRoot, 'supabase', 'migrations')
      const files = (await fs.readdir(migrationsDir))
        .filter((f) => f.endsWith('.sql'))
        .sort()
      let okCount = 0
      let skipCount = 0
      for (const f of files) {
        if (STORAGE_SKIP.has(f)) {
          console.log(`  SKIP (storage): ${f}`)
          skipCount++
          continue
        }
        const sqlText = await fs.readFile(path.join(migrationsDir, f), 'utf8')
        try {
          await dst.unsafe(sqlText)
          console.log(`  ✓ ${f}`)
          okCount++
        } catch (e) {
          const msg = String(e?.message || e)
          if (/already exists|duplicate|does not exist/i.test(msg)) {
            console.log(`  ~ ${f}  (warn: ${msg.split('\n')[0]})`)
            okCount++
          } else {
            console.error(`  ✗ ${f}: ${msg}`)
            throw e
          }
        }
      }
      console.log(`  → applied=${okCount}  skipped=${skipCount}`)
    }
    console.log('')

    /* ============================================================
       [3/6] 表清单 + FK 依赖
    ============================================================ */
    console.log('=== [3/6] 发现表 + FK 依赖')
    const srcTables = (
      await src`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    ).map((r) => r.table_name)

    const dstTables = (
      await dst`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    ).map((r) => r.table_name)

    const tablesToMigrate = srcTables.filter((t) => dstTables.includes(t))
    const onlyInSrc = srcTables.filter((t) => !dstTables.includes(t))
    const onlyInDst = dstTables.filter((t) => !srcTables.includes(t))

    console.log(`  Neon tables (${srcTables.length}):   `, srcTables.join(', '))
    console.log(`  Tencent tables (${dstTables.length}):`, dstTables.join(', '))
    if (onlyInSrc.length) console.log(`  ⚠ 仅在 Neon 上: ${onlyInSrc.join(', ')}（将被跳过）`)
    if (onlyInDst.length) console.log(`  ⚠ 仅在 Tencent 上: ${onlyInDst.join(', ')}`)

    /* FK 边（child 依赖 parent）, 排除自引用 */
    const fks = await src`
      SELECT
        tc.table_name      AS child,
        ccu.table_name     AS parent,
        kcu.column_name    AS child_col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name   = kcu.constraint_name
       AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name   = rc.constraint_name
       AND tc.constraint_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name   = ccu.constraint_name
       AND rc.unique_constraint_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_schema = 'public'
    `

    const edges = []
    /* 表 → Set<自引用列名> */
    const selfFkCols = new Map()
    for (const row of fks) {
      if (!tablesToMigrate.includes(row.child) || !tablesToMigrate.includes(row.parent)) continue
      if (row.child === row.parent) {
        if (!selfFkCols.has(row.child)) selfFkCols.set(row.child, new Set())
        selfFkCols.get(row.child).add(row.child_col)
      } else {
        edges.push([row.parent, row.child])
      }
    }

    const order = topoSort(tablesToMigrate, edges)
    console.log(`  → 插入顺序 (${order.length}): ${order.join(' → ')}`)
    if (selfFkCols.size > 0) {
      const desc = [...selfFkCols.entries()].map(([t, cs]) => `${t}.${[...cs].join(',')}`).join('; ')
      console.log(`  → 自引用 FK（两阶段处理）: ${desc}`)
    }
    console.log('')

    /* ============================================================
       [4/6] 反依赖顺序清空目标表
    ============================================================ */
    console.log('=== [4/6] 清空腾讯云目标表（保留 schema）')
    for (const t of [...order].reverse()) {
      const r = await dst.unsafe(`DELETE FROM ${quoteIdent(t)}`)
      console.log(`  DELETE ${t}: ${r.count ?? '?'} rows`)
    }
    console.log('')

    /* ============================================================
       [5/6] 按依赖顺序复制数据
    ============================================================ */
    console.log('=== [5/6] 复制数据 Neon → Tencent')
    const counts = {}

    for (const t of order) {
      const rows = await src.unsafe(`SELECT * FROM public.${quoteIdent(t)}`)
      counts[t] = { src: rows.length, dst: 0 }

      if (rows.length === 0) {
        console.log(`  ${t}: empty`)
        continue
      }

      const cols = Object.keys(rows[0])
      const selfFks = selfFkCols.get(t) // Set | undefined

      /* Pass 1: 自引用列置 NULL 后整批插入 */
      const pass1 = selfFks
        ? rows.map((r) => {
            const c = { ...r }
            for (const k of selfFks) c[k] = null
            return c
          })
        : rows

      let inserted = 0
      for (let i = 0; i < pass1.length; i += BATCH_SIZE) {
        const batch = pass1.slice(i, i + BATCH_SIZE)
        try {
          await dst`INSERT INTO ${dst(t)} ${dst(batch, ...cols)}`
        } catch (e) {
          /* 单行失败时切到逐行重试，便于打印问题行 */
          if (batch.length === 1) {
            console.error(`  ✗ ${t} row id=${batch[0]?.id || '?'}: ${e?.message}`)
            throw e
          }
          console.warn(`  ! ${t} batch失败 (${e?.message?.split('\n')[0]})，切单行重试...`)
          for (const r of batch) {
            try {
              await dst`INSERT INTO ${dst(t)} ${dst([r], ...cols)}`
              inserted++
            } catch (e2) {
              console.error(`    ✗ ${t} row id=${r?.id || '?'}: ${e2?.message?.split('\n')[0]}`)
            }
          }
          continue
        }
        inserted += batch.length
      }

      /* Pass 2: 自引用列回填 UPDATE */
      if (selfFks && selfFks.size > 0) {
        let updated = 0
        for (const r of rows) {
          const updates = []
          for (const k of selfFks) if (r[k] != null) updates.push([k, r[k]])
          if (updates.length === 0) continue
          const setParts = updates
            .map(([k], idx) => `${quoteIdent(k)} = $${idx + 2}`)
            .join(', ')
          const params = [r.id, ...updates.map(([, v]) => v)]
          await dst.unsafe(
            `UPDATE ${quoteIdent(t)} SET ${setParts} WHERE id = $1`,
            params,
          )
          updated++
        }
        console.log(
          `  ${t}: inserted=${inserted} (${rows.length} src), 自引用回填=${updated}`,
        )
      } else {
        console.log(`  ${t}: inserted=${inserted} (${rows.length} src)`)
      }
      counts[t].dst = inserted
    }
    console.log('')

    /* ============================================================
       [6/6] 行数对比
    ============================================================ */
    console.log('=== [6/6] 行数对比')
    let allMatch = true
    const reportRows = []
    for (const t of order) {
      const [{ count: dstCount }] = await dst.unsafe(
        `SELECT COUNT(*)::int AS count FROM ${quoteIdent(t)}`,
      )
      const match = counts[t].src === dstCount
      if (!match) allMatch = false
      reportRows.push({ table: t, neon: counts[t].src, tencent: dstCount, ok: match })
      console.log(`  ${match ? '✓' : '✗'} ${t.padEnd(28)} Neon=${counts[t].src.toString().padStart(6)}  Tencent=${dstCount.toString().padStart(6)}`)
    }

    /* 写一份报告到 dumps/ */
    const reportDir = path.join(projectRoot, 'dumps')
    await fs.mkdir(reportDir, { recursive: true })
    await fs.writeFile(
      path.join(reportDir, 'migration-report.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          neon: mask(NEON_URL),
          tencent: mask(TENCENT_URL),
          tables: reportRows,
          allMatch,
        },
        null,
        2,
      ),
    )

    console.log('')
    console.log(allMatch ? '=== ✅ 全部表行数一致' : '=== ⚠ 行数不一致，请人工排查 dumps/migration-report.json')
    console.log('')
    console.log('下一步建议：')
    console.log('  1. 把 .env.local 的 DATABASE_URL 临时切到 TENCENT_DATABASE_URL（公网串），跑 pnpm dev 验证')
    console.log('  2. 验证通过后切到 VPC 内网串，部署到 CloudBase Run')
    console.log('  3. 或保持 DATABASE_URL=Neon 不动，新增 USE_TENCENT_DB=1 的开关再切流')
  } finally {
    await Promise.allSettled([src.end({ timeout: 5 }), dst.end({ timeout: 5 })])
  }
}

main().catch((e) => {
  console.error('\n✗ FATAL:', e?.message || e)
  if (e?.detail) console.error('  detail:', e.detail)
  if (e?.where) console.error('  where:', e.where)
  if (e?.hint) console.error('  hint:', e.hint)
  process.exit(1)
})
