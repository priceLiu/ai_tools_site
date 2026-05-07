import { getNeonSql } from '@/lib/neon/sql'

let cached: Promise<boolean> | null = null

/** 执行迁移新增列后，重启进程以便重新探测（否则会沿用旧的「无列」缓存）。 */
export function neonInvalidateTagsLinkedAtColumnCache(): void {
  cached = null
}

/** `tags.tag_category_linked_at` 是否存在（查 information_schema，进程内缓存）。 */
export async function neonTagsHasTagCategoryLinkedAtColumn(): Promise<boolean> {
  if (!cached) {
    cached = (async () => {
      const sql = getNeonSql()
      try {
        const rows = await sql`
          SELECT 1 AS ok
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tags'
            AND column_name = 'tag_category_linked_at'
          LIMIT 1
        `
        return rows.length > 0
      } catch {
        return false
      }
    })()
  }
  return cached
}
