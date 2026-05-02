'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未登录')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    throw new Error('无权限')
  }
  return { supabase, user }
}

export async function adminSetProfileAdminAction(
  profileUserId: string,
  isAdmin: boolean,
) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', profileUserId)
  if (error) {
    throw new Error(error.message)
  }
  revalidatePath('/admin/users')
}

export async function adminSetProfileDisabledAction(
  profileUserId: string,
  isDisabled: boolean,
) {
  const { supabase, user } = await requireAdmin()
  if (profileUserId === user.id && isDisabled) {
    throw new Error('不能禁用当前登录账号，请先由其他管理员操作')
  }
  const { error } = await supabase
    .from('profiles')
    .update({ is_disabled: isDisabled })
    .eq('id', profileUserId)
  if (error) {
    throw new Error(error.message)
  }
  revalidatePath('/admin/users')
}
