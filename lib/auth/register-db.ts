import { getNeonSql } from '@/lib/neon/sql'

export async function neonInsertProfileForNewUser(userId: string): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO profiles (id, display_name, avatar_url, is_admin, is_disabled, created_at)
    VALUES (${userId}, null, null, false, false, now())
  `
}

export async function neonDeleteProfile(userId: string): Promise<void> {
  const sql = getNeonSql()
  await sql`DELETE FROM profiles WHERE id = ${userId}`
}
