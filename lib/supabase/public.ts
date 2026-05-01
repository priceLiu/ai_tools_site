import { createClient } from '@supabase/supabase-js'

/** 无 Cookie 的匿名客户端，仅用于可公开读取的数据；配合 unstable_cache 使用。 */
export function createPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(url, key)
}
