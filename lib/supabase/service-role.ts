import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** 服务端管理员操作可选；有则绕过 RLS（须在代码中先校验 is_admin） */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key?.trim()) return null
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
