import argon2 from 'argon2'
import bcrypt from 'bcryptjs'

/**
 * 校验 `auth_credentials.password_hash`。
 * - 本站注册：`bcryptjs` 生成的 `$2a$` / `$2b$` / `$2y$`
 * - 从 Supabase `auth.users.encrypted_password` 迁入：多为 bcrypt；新项目也可能是 **Argon2**（`$argon2id$...`）
 * - `$fbscrypt$`（Firebase 迁入）此处不支持，需用户重设密码
 */
export async function verifyStoredPasswordHash(
  plainPassword: string,
  storedHash: string,
): Promise<boolean> {
  if (!plainPassword || !storedHash) return false
  const hash = storedHash.trim()
  if (!hash) return false

  if (hash.startsWith('$argon2')) {
    try {
      return await argon2.verify(hash, plainPassword)
    } catch {
      return false
    }
  }

  if (
    hash.startsWith('$2a$') ||
    hash.startsWith('$2b$') ||
    hash.startsWith('$2y$')
  ) {
    try {
      return bcrypt.compareSync(plainPassword, hash)
    } catch {
      return false
    }
  }

  try {
    return bcrypt.compareSync(plainPassword, hash)
  } catch {
    return false
  }
}
