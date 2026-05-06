#!/usr/bin/env node
/**
 * 单文件 Neon 迁移执行器（无需 psql，使用项目里已有的 `postgres` 包）。
 *
 * 用法（在项目根目录）：
 *   node scripts/apply-neon-migration.mjs supabase/migrations/<file>.sql
 *
 * 多个文件按顺序执行：
 *   node scripts/apply-neon-migration.mjs \
 *     supabase/migrations/20260506000000_tag_categories_and_curated_tags.sql \
 *     supabase/migrations/20260506000100_seed_tag_categories_and_curated_tags.sql
 *
 * 读取 .env.local 里的 DATABASE_URL；可用 `DATABASE_URL=... node ...` 覆盖。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function loadDotEnvLocal() {
  if (process.env.DATABASE_URL) return
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
    /** .env.local 不存在则期待外部已经设置 DATABASE_URL */
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error(
      '用法: node scripts/apply-neon-migration.mjs <file.sql> [more.sql...]',
    )
    process.exit(1)
  }

  await loadDotEnvLocal()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('未设置 DATABASE_URL（.env.local 或环境变量）')
    process.exit(1)
  }

  const { default: postgres } = await import('postgres')
  const sql = postgres(databaseUrl, {
    ssl: 'require',
    max: 1,
    /** 复杂迁移含多语句，关闭 prepared statement */
    prepare: false,
  })

  let failed = false
  try {
    for (const arg of args) {
      const filePath = path.isAbsolute(arg) ? arg : path.resolve(projectRoot, arg)
      const base = path.basename(filePath)
      const text = await fs.readFile(filePath, 'utf8')
      console.log(`=== ${base}`)
      try {
        await sql.unsafe(text)
        console.log(`    ✓ 成功`)
      } catch (e) {
        failed = true
        console.error(
          `    ✗ 失败: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  } finally {
    await sql.end({ timeout: 5 })
  }

  if (failed) {
    process.exit(2)
  }
  console.log('=== 全部迁移已应用')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
