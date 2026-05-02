'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'

export async function updateApprovedToolAdminAction(input: {
  toolId: string
  name: string
  description: string
  website_url: string
  /** 不传则不改数据库中的 is_disabled（由独立按钮切换） */
  is_disabled?: boolean
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: '无权限' }

  const name = input.name.trim()
  const description = input.description.trim()
  const website_url = input.website_url.trim()
  if (!name) return { error: '名称不能为空' }
  if (!description) return { error: '描述不能为空' }
  if (!website_url) return { error: '网站地址不能为空' }
  try {
    new URL(website_url)
  } catch {
    return { error: '网站地址格式无效' }
  }

  const { data: tool, error: fetchErr } = await supabase
    .from('tools')
    .select('id,slug,status')
    .eq('id', input.toolId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!tool) return { error: '工具不存在' }
  if (tool.status !== 'approved') return { error: '仅可编辑已通过审核的工具' }

  const patch: {
    name: string
    description: string
    website_url: string
    updated_at: string
    is_disabled?: boolean
  } = {
    name,
    description,
    website_url,
    updated_at: new Date().toISOString(),
  }
  if (typeof input.is_disabled === 'boolean') {
    patch.is_disabled = input.is_disabled
  }

  const { error } = await supabase.from('tools').update(patch).eq('id', input.toolId)

  if (error) return { error: error.message }

  await revalidateHomeToolBundleAction()
  revalidatePath('/')
  revalidatePath(`/tool/${tool.slug}`)
  revalidatePath(`/admin/tools/${input.toolId}`)
  revalidatePath('/admin')
  return {}
}
