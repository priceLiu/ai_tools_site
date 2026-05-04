import { getNeonSql } from '@/lib/neon/sql'

export type AuthCredentialRow = {
  user_id: string
  email: string
  password_hash: string
}

export async function neonFindAuthCredentialsByEmail(
  email: string,
): Promise<AuthCredentialRow | null> {
  const normalized = email.trim().toLowerCase()
  const sql = getNeonSql()
  const rows = await sql`
    SELECT user_id, email, password_hash
    FROM public.auth_credentials
    WHERE lower(trim(email)) = ${normalized}
    LIMIT 1
  `
  const r = rows[0] as AuthCredentialRow | undefined
  return r ?? null
}

export async function neonInsertAuthCredentials(
  userId: string,
  email: string,
  passwordHash: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO public.auth_credentials (user_id, email, password_hash)
    VALUES (${userId}, ${email.trim().toLowerCase()}, ${passwordHash})
  `
}

export async function neonEmailTaken(email: string): Promise<boolean> {
  const row = await neonFindAuthCredentialsByEmail(email)
  return row != null
}

export async function neonFindAuthCredentialsByUserId(
  userId: string,
): Promise<AuthCredentialRow | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT user_id, email, password_hash
    FROM public.auth_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `
  const r = rows[0] as AuthCredentialRow | undefined
  return r ?? null
}

export async function neonUpdateAuthCredentialsPasswordHash(
  userId: string,
  passwordHash: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE public.auth_credentials
    SET password_hash = ${passwordHash}, updated_at = now()
    WHERE user_id = ${userId}
  `
}
