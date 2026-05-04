'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { toolPublicPath } from '@/lib/tool-public-path'
import * as neon from '@/lib/neon/data'
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
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const adminOk = await neon.neonGetProfileIsAdmin(user.id)
  if (!adminOk) return { error: '无权限' }

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
    const exists = await neon.neonCategoryExistsById(category_id)
    if (!exists) return { error: '所选分类不存在' }
  }

  const tool = await neon.neonGetToolAdminMetaById(input.toolId)
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

  await neon.neonAdminUpdateToolFull(input.toolId, patch)

  await revalidateHomeToolBundleAction()
  revalidatePath(toolPublicPath(tool.slug))
  revalidatePath('/category/[slug]', 'page')
  revalidatePath(`/admin/tools/${input.toolId}`)
  revalidatePath('/admin')
  return {}
}

const BULK_HIDE_MAX = 100

/**
 * 批量隐藏 / 还原工具（替代以前的「批量删除工具」）。
 *
 * 工具一律不删除，避免误操作造成不可恢复的数据丢失：
 *  - hidden=true  → `is_disabled=true`，前台不再展示
 *  - hidden=false → `is_disabled=false`，前台恢复展示
 */
export async function setToolsHiddenAdminAction(input: {
  toolIds: string[]
  hidden: boolean
}): Promise<{ error?: string; affected?: number }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const adminOk = await neon.neonGetProfileIsAdmin(user.id)
  if (!adminOk) return { error: '无权限' }

  const ids = [...new Set(input.toolIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { error: '未选择工具' }
  if (ids.length > BULK_HIDE_MAX) {
    return { error: `单次最多操作 ${BULK_HIDE_MAX} 条` }
  }

  const rows = await neon.neonListToolsByIdsMeta(ids)
  if (!rows?.length) return { error: '未找到可操作的工具' }

  const rowIds = rows.map((r) => r.id)
  const n = await neon.neonAdminBulkSetToolsDisabled(rowIds, input.hidden)
  if (n !== rowIds.length) {
    return {
      error:
        n === 0
          ? '更新未生效（0 条）。请检查 Neon 连接与 tools 表。'
          : `更新不完整（${n}/${rowIds.length}）。请重试或检查数据库。`,
    }
  }

  const hadApproved = rows.some((r) => r.status === 'approved')
  if (hadApproved) {
    await revalidateHomeToolBundleAction()
    revalidatePath('/category/[slug]', 'page')
  }
  revalidatePath('/admin')
  for (const row of rows) {
    if (row.slug?.trim()) {
      revalidatePath(toolPublicPath(row.slug))
    }
    revalidatePath(`/admin/tools/${row.id}`)
  }

  return { affected: rows.length }
}
