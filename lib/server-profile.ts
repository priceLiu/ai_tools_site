import { neonGetProfileById } from '@/lib/neon/data'
import type { Profile } from '@/lib/types'

/** SSR：当前用户资料（Neon） */
export async function getSessionProfile(userId: string): Promise<Profile | null> {
  return neonGetProfileById(userId)
}
