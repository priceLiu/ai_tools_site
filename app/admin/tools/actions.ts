'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { toolPublicPath } from '@/lib/tool-public-path'
import {
  INTRO_LIMIT_PLAIN,
  INTRO_LIMIT_RICH,
  normalizeIntroductionFormat,
  type IntroductionFormat,
} from '@/lib/introduction-format'

function normalizeOptionalMediaUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('data:image/')) {
    if (t.length > 3_500_000) return null
    return t
  }
  try {
    return new URL(t).toString()
  } catch {
    return null
  }
}

export async function updateApprovedToolAdminAction(input: {
  toolId: string
  name: string
  description: string
  website_url: string
  logo_url: string | null
  screenshot_url: string | null
  introduction: string | null
  introduction_format: IntroductionFormat
  category_id: string | null
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
  const introFmt = normalizeIntroductionFormat(input.introduction_format)
  const introduction = (input.introduction ?? '').trim()
  const introLimit = introFmt === 'plain' ? INTRO_LIMIT_PLAIN : INTRO_LIMIT_RICH

  if (!name) return { error: '名称不能为空' }
  if (!description) return { error: '概述描述不能为空' }
  if (!website_url) return { error: '网站地址不能为空' }
  try {
    new URL(website_url)
  } catch {
    return { error: '网站地址格式无效' }
  }
  if (introduction.length > introLimit) {
    return { error: `工具介绍过长（当前格式最多 ${introLimit} 字）` }
  }

  const logo_url = normalizeOptionalMediaUrl(input.logo_url)
  const screenshot_url = normalizeOptionalMediaUrl(input.screenshot_url)
  if (input.logo_url != null && String(input.logo_url).trim() && logo_url === null) {
    return { error: 'Logo 地址无效（须为 http(s) 链接或 data:image）' }
  }
  if (
    input.screenshot_url != null &&
    String(input.screenshot_url).trim() &&
    screenshot_url === null
  ) {
    return { error: '截图地址无效（须为 http(s) 链接或 data:image）' }
  }

  const categoryIdRaw = input.category_id?.trim() ?? ''
  const category_id = categoryIdRaw || null
  if (category_id) {
    const { data: catRow, error: catErr } = await supabase
      .from('categories')
      .select('id')
      .eq('id', category_id)
      .maybeSingle()
    if (catErr) return { error: catErr.message }
    if (!catRow) return { error: '所选分类不存在' }
  }

  const { data: tool, error: fetchErr } = await supabase
    .from('tools')
    .select('id,slug,status')
    .eq('id', input.toolId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!tool) return { error: '工具不存在' }

  const patch: {
    name: string
    description: string
    website_url: string
    logo_url: string | null
    screenshot_url: string | null
    introduction: string | null
    introduction_format: IntroductionFormat
    category_id: string | null
    updated_at: string
    is_disabled?: boolean
  } = {
    name,
    description,
    website_url,
    logo_url,
    screenshot_url,
    introduction: introduction.length > 0 ? introduction : null,
    introduction_format: introFmt,
    category_id,
    updated_at: new Date().toISOString(),
  }
  if (typeof input.is_disabled === 'boolean') {
    patch.is_disabled = input.is_disabled
  }

  const { error } = await supabase.from('tools').update(patch).eq('id', input.toolId)

  if (error) return { error: error.message }

  await revalidateHomeToolBundleAction()
  revalidatePath('/')
  revalidatePath(toolPublicPath(tool.slug))
  revalidatePath(`/admin/tools/${input.toolId}`)
  revalidatePath('/admin')
  return {}
}

const BULK_DELETE_MAX = 100

export async function deleteToolsAdminAction(input: {
  toolIds: string[]
}): Promise<{ error?: string; deleted?: number }> {
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

  const ids = [...new Set(input.toolIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { error: '未选择工具' }
  if (ids.length > BULK_DELETE_MAX) {
    return { error: `单次最多删除 ${BULK_DELETE_MAX} 条` }
  }

  const { data: rows, error: fetchErr } = await supabase
    .from('tools')
    .select('id,slug,status')
    .in('id', ids)
  if (fetchErr) return { error: fetchErr.message }
  if (!rows?.length) return { error: '未找到可删除的工具' }

  const rowIds = rows.map((r) => r.id)
  const db = createServiceRoleClient() ?? supabase

  const { data: deletedRows, error: delErr } = await db
    .from('tools')
    .delete()
    .in('id', rowIds)
    .select('id')
  if (delErr) return { error: delErr.message }
  const n = deletedRows?.length ?? 0
  if (n !== rowIds.length) {
    return {
      error:
        n === 0
          ? '删除未生效（0 条）。请在 Supabase 配置 SUPABASE_SERVICE_ROLE_KEY，或对 tools 表启用管理员 DELETE 策略（见迁移 20260502250000_tools_admin_delete_rls.sql）。'
          : `删除不完整（${n}/${rowIds.length}）。请重试或检查数据库与策略。`,
    }
  }

  const hadApproved = rows.some((r) => r.status === 'approved')
  if (hadApproved) {
    await revalidateHomeToolBundleAction()
  }
  revalidatePath('/')
  revalidatePath('/admin')
  for (const row of rows) {
    if (row.slug?.trim()) {
      revalidatePath(toolPublicPath(row.slug))
    }
    revalidatePath(`/admin/tools/${row.id}`)
  }

  return { deleted: rows.length }
}
