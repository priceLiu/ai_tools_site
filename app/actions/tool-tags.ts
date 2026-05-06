'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import {
  neonGetCategoryNameById,
  neonGetProfileIsAdmin,
  neonGetToolNameDescriptionById,
  neonListToolsIdIntroFormatCategoryName,
  neonSetToolTagsForTool,
} from '@/lib/neon/data'
import {
  buildSuggestedToolTagNames,
  TOOL_TAGS_MAX,
} from '@/lib/tool-tags-extract'
import {
  HOME_ADS_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'
import { loadHomeToolBundle } from '@/lib/cached-home-data'
import { uploadHomeToolBundleSnapshot } from '@/lib/home-bundle-snapshot'
import type { IntroductionFormat } from '@/lib/introduction-format'

function normalizeTagNames(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const n = t.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!n) continue
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
    if (out.length >= TOOL_TAGS_MAX) break
  }
  return out
}

/**
 * 登录用户：根据分类 + 介绍生成标签建议（不入库）
 *
 * 可选 `toolId`：如果提供则后端会再去查 tools.name / tools.description，
 * 让标题/描述参与匹配评分（权重 5/3，介绍 1）。
 */
export async function suggestToolTagNamesAction(input: {
  introduction: string
  introductionFormat: IntroductionFormat
  categoryId: string | null
  toolId?: string | null
  /** 可选：直接传入 name/description，避免再次查询 DB */
  name?: string | null
  description?: string | null
}): Promise<{ names: string[] } | { error: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  let categoryName: string | null = null
  if (input.categoryId?.trim()) {
    categoryName = await neonGetCategoryNameById(input.categoryId.trim())
  }

  let name = input.name ?? null
  let description = input.description ?? null
  if ((!name || !description) && input.toolId?.trim()) {
    const meta = await neonGetToolNameDescriptionById(input.toolId.trim())
    if (meta) {
      if (!name) name = meta.name
      if (!description) description = meta.description
    }
  }

  const names = buildSuggestedToolTagNames({
    categoryName,
    name,
    description,
    introduction: input.introduction,
    introductionFormat: input.introductionFormat,
  })
  return { names: normalizeTagNames(names) }
}

/**
 * 写入工具标签（所有者或管理员）
 */
export async function setToolTagsAction(input: {
  toolId: string
  tagNames: string[]
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const names = normalizeTagNames(input.tagNames)
  const isAdmin = await neonGetProfileIsAdmin(user.id)
  return neonSetToolTagsForTool({
    actorUserId: user.id,
    actorIsAdmin: isAdmin,
    toolId: input.toolId,
    names,
  })
}

/**
 * 管理员：为全部工具按当前规则重写标签。
 *
 * 完成后会：
 *   - 重建 `app_kv` 首页快照
 *   - 失效首页 / 分类 / 详情 ISR
 *   - 失效 `/tag-category/[slug]` 与 `/tag/[slug]`
 */
export async function bulkExtractToolTagsAdminAction(): Promise<{
  ok: boolean
  updated: number
  error?: string
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, updated: 0, error: '未登录' }

  const isAdmin = await neonGetProfileIsAdmin(user.id)
  if (!isAdmin) return { ok: false, updated: 0, error: '无权限' }

  const rows = await neonListToolsIdIntroFormatCategoryName()
  let updated = 0
  for (const row of rows) {
    const names = buildSuggestedToolTagNames({
      categoryName: row.category_name,
      name: row.name,
      description: row.description,
      introduction: row.introduction ?? '',
      introductionFormat: row.introduction_format as IntroductionFormat,
    })
    const res = await neonSetToolTagsForTool({
      actorUserId: user.id,
      actorIsAdmin: true,
      toolId: row.id,
      names: normalizeTagNames(names),
    })
    if (!res.error) updated += 1
  }

  try {
    const bundle = await loadHomeToolBundle()
    await uploadHomeToolBundleSnapshot(bundle)
  } catch {
    /* 失败不影响主流程 */
  }
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/category/[slug]', 'page')
  revalidatePath('/tool/[slug]', 'page')
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')

  return { ok: true, updated }
}
