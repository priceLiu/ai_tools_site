'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { generateToolSlug } from '@/lib/tool-slug'
import { randomToolViewSeed } from '@/lib/tool-view-seed'
import { fetchImageAsDataUrl } from '@/lib/fetch-image-as-data-url'
import * as neon from '@/lib/neon/data'
import {
  toolNameDedupKey,
  toolIntroductionPreviewDedup,
  TOOL_DEDUP_REJECT_MESSAGE,
} from '@/lib/tool-dedup'
import {
  parseDocsToolsJson,
  type DocsToolJsonItem,
} from '@/lib/parse-docs-tools-json'
import {
  excerptForListing,
  INTRO_LIMIT_RICH,
} from '@/lib/introduction-format'
import {
  buildSuggestedToolTagNames,
  TOOL_TAGS_MAX,
} from '@/lib/tool-tags-extract'

export type ImportToolsRowResult = {
  name: string
  ok: boolean
  message?: string
}

export type ImportTagPreviewRow = {
  index: number
  name: string
  tags: string[]
}

type BulkImportTaxonomyInput = {
  categoryId?: string | null
  sceneCategoryId?: string | null
  roleCategoryId?: string | null
}

type ResolvedBulkImportTaxonomy =
  | {
      ok: true
      categoryId: string | null
      categoryName: string | null
      sceneCategoryName: string | null
      roleCategoryName: string | null
    }
  | { ok: false; error: string }

async function resolveBulkImportTaxonomy(
  input: BulkImportTaxonomyInput,
): Promise<ResolvedBulkImportTaxonomy> {
  const categoryId = input.categoryId?.trim() || null
  const sceneCategoryId = input.sceneCategoryId?.trim() || null
  const roleCategoryId = input.roleCategoryId?.trim() || null

  if (!categoryId && !sceneCategoryId && !roleCategoryId) {
    return {
      ok: false,
      error:
        '请至少选择「首页左侧菜单分类」「场景分类」「角色分类」中的一项',
    }
  }

  let categoryName: string | null = null
  if (categoryId) {
    categoryName = await neon.neonGetCategoryNameById(categoryId)
    if (categoryName == null) {
      return { ok: false, error: '所选首页左侧菜单分类不存在' }
    }
  }

  let sceneCategoryName: string | null = null
  if (sceneCategoryId) {
    const tc = await neon.neonGetTagCategoryById(sceneCategoryId)
    if (!tc) return { ok: false, error: '所选场景分类不存在' }
    sceneCategoryName = tc.name
  }

  let roleCategoryName: string | null = null
  if (roleCategoryId) {
    const rc = await neon.neonGetRoleCategoryById(roleCategoryId)
    if (!rc) return { ok: false, error: '所选角色分类不存在' }
    roleCategoryName = rc.name
  }

  return {
    ok: true,
    categoryId,
    categoryName,
    sceneCategoryName,
    roleCategoryName,
  }
}

/** 批量导入：对一段条目预览关键词匹配后的标签（用于前台进度展示）。 */
export async function batchSuggestTagsForImportAction(input: {
  items: unknown
  categoryId?: string | null
  sceneCategoryId?: string | null
  roleCategoryId?: string | null
  baseIndex: number
}): Promise<{
  ok: boolean
  error?: string
  rows?: ImportTagPreviewRow[]
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: '未登录' }
  const adminOk = await neon.neonGetProfileIsAdmin(user.id)
  if (!adminOk) return { ok: false, error: '无权限' }

  const tax = await resolveBulkImportTaxonomy({
    categoryId: input.categoryId,
    sceneCategoryId: input.sceneCategoryId,
    roleCategoryId: input.roleCategoryId,
  })
  if (!tax.ok) return { ok: false, error: tax.error }

  const parsed = parseDocsToolsJson(input.items)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const rows: ImportTagPreviewRow[] = []
  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i]
    const description = excerptForListing(item.introduction, 'markdown')
    const tags = buildSuggestedToolTagNames({
      categoryName: tax.categoryName,
      sceneCategoryName: tax.sceneCategoryName,
      roleCategoryName: tax.roleCategoryName,
      name: toolNameDedupKey(item.name),
      description,
      introduction: item.introduction,
      introductionFormat: 'markdown',
    })
    rows.push({
      index: input.baseIndex + i,
      name: item.name,
      tags,
    })
  }
  return { ok: true, rows }
}

/**
 * 导入 `DocsToolJsonItem[]` 的一段（可多段串联以实现进度条）。
 * `tagByRelativeIndex` 的键为相对于本段 items 的下标 `"0".."length-1"`。
 */
export async function importDocsToolsItemsAction(input: {
  items: unknown
  categoryId?: string | null
  sceneCategoryId?: string | null
  roleCategoryId?: string | null
  initialStatus: 'approved' | 'pending'
  tagByRelativeIndex?: Record<string, string[]>
  deferBundleRevalidate?: boolean
}): Promise<{
  ok: boolean
  error?: string
  results?: ImportToolsRowResult[]
  imported?: number
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: '未登录' }

  const adminOk = await neon.neonGetProfileIsAdmin(user.id)
  if (!adminOk) return { ok: false, error: '无权限' }

  const tax = await resolveBulkImportTaxonomy({
    categoryId: input.categoryId,
    sceneCategoryId: input.sceneCategoryId,
    roleCategoryId: input.roleCategoryId,
  })
  if (!tax.ok) return { ok: false, error: tax.error }

  const parsed = parseDocsToolsJson(input.items)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const items = parsed.items
  if (items.length === 0) return { ok: false, error: '没有可导入的条目' }

  const tagMap = input.tagByRelativeIndex ?? {}

  const results: ImportToolsRowResult[] = []
  let imported = 0
  let anyApproved = false

  for (let i = 0; i < items.length; i++) {
    const relKey = String(i)
    const pre =
      tagMap[relKey] !== undefined ? tagMap[relKey] : undefined
    const rowRes = await importOneTool({
      item: items[i],
      categoryId: tax.categoryId,
      categoryName: tax.categoryName,
      sceneCategoryName: tax.sceneCategoryName,
      roleCategoryName: tax.roleCategoryName,
      userId: user.id,
      status: input.initialStatus,
      precomputedTags: pre,
    })
    results.push(rowRes)
    if (rowRes.ok) {
      imported++
      if (input.initialStatus === 'approved') anyApproved = true
    }
  }

  if (anyApproved && !input.deferBundleRevalidate) {
    await revalidateHomeToolBundleAction()
    revalidatePath('/category/[slug]', 'page')
  }
  revalidatePath('/admin')

  return { ok: true, results, imported }
}

export async function importToolsFromDocsJsonAction(input: {
  rawJson: unknown
  categoryId?: string | null
  sceneCategoryId?: string | null
  roleCategoryId?: string | null
  initialStatus: 'approved' | 'pending'
  /** 与完整列表下标对齐：`"0"`…；若省略则导入时每条服务端自动算标签 */
  tagByRelativeIndex?: Record<string, string[]>
}): Promise<{
  ok: boolean
  error?: string
  results?: ImportToolsRowResult[]
  imported?: number
}> {
  const parsed = parseDocsToolsJson(input.rawJson)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  return importDocsToolsItemsAction({
    items: parsed.items,
    categoryId: input.categoryId,
    sceneCategoryId: input.sceneCategoryId,
    roleCategoryId: input.roleCategoryId,
    initialStatus: input.initialStatus,
    tagByRelativeIndex: input.tagByRelativeIndex,
    deferBundleRevalidate: false,
  })
}

async function importOneTool(opts: {
  item: DocsToolJsonItem
  categoryId: string | null
  categoryName: string | null
  sceneCategoryName: string | null
  roleCategoryName: string | null
  userId: string
  status: 'approved' | 'pending'
  /** 若传入数组（可为空）则跳过词典计算，直接写入（上限截断） */
  precomputedTags?: string[]
}): Promise<ImportToolsRowResult> {
  const {
    item,
    categoryId,
    categoryName,
    sceneCategoryName,
    roleCategoryName,
    userId,
    status,
  } = opts
  const name = item.name

  if (item.introduction.length > INTRO_LIMIT_RICH) {
    return {
      name,
      ok: false,
      message: `介绍超过 ${INTRO_LIMIT_RICH} 字`,
    }
  }

  let website_url = item.official_url.trim()
  try {
    const u = new URL(website_url)
    website_url = u.toString()
  } catch {
    return { name, ok: false, message: '官网地址无效' }
  }

  let logo_url: string | null = null
  let logoNote = ''
  if (item.logo_url?.trim()) {
    const rawLogo = item.logo_url.trim()
    if (rawLogo.startsWith('data:image/')) {
      logo_url = rawLogo
    } else {
      const fetched = await fetchImageAsDataUrl(rawLogo)
      if ('dataUrl' in fetched) {
        logo_url = fetched.dataUrl
      } else if (
        rawLogo.startsWith('https://') ||
        rawLogo.startsWith('http://')
      ) {
        logo_url = rawLogo
        logoNote = `图标未转存为 Base64：${fetched.error}（已保存原始图标 URL）`
      } else {
        logoNote = `图标未写入：${fetched.error}`
      }
    }
  }

  const description = excerptForListing(item.introduction, 'markdown')
  if (!description) {
    return { name, ok: false, message: '无法从简介生成概述' }
  }

  const dupId = await neon.neonFindDuplicateTool(
    toolNameDedupKey(item.name),
    categoryId,
    toolIntroductionPreviewDedup(item.introduction),
    null,
  )
  if (dupId) {
    return { name, ok: false, message: TOOL_DEDUP_REJECT_MESSAGE }
  }

  const slug = generateToolSlug(toolNameDedupKey(item.name))

  const insertRow: Record<string, unknown> = {
    name: toolNameDedupKey(item.name),
    slug,
    description,
    introduction: item.introduction,
    introduction_format: 'markdown' as const,
    website_url,
    category_id: categoryId,
    logo_url,
    screenshot_url: null,
    user_id: userId,
    status,
    is_featured: false,
    is_disabled: false,
    rejection_reason: null,
    use_cases: null,
  }
  if (status === 'approved') {
    insertRow.view_count = randomToolViewSeed()
  }

  let insertedId: string
  try {
    insertedId = await neon.neonSubmitInsertTool({ values: insertRow })
  } catch (e) {
    return {
      name,
      ok: false,
      message: e instanceof Error ? e.message : '写入失败',
    }
  }

  const tagNames =
    opts.precomputedTags !== undefined
      ? opts.precomputedTags.slice(0, TOOL_TAGS_MAX)
      : buildSuggestedToolTagNames({
          categoryName,
          sceneCategoryName,
          roleCategoryName,
          name: toolNameDedupKey(item.name),
          description,
          introduction: item.introduction,
          introductionFormat: 'markdown',
        })

  let tagNote = ''
  const tagRes = await neon.neonSetToolTagsForTool({
    actorUserId: userId,
    actorIsAdmin: true,
    toolId: insertedId,
    names: tagNames,
  })
  if (tagRes.error) tagNote = `标签未写入：${tagRes.error}`

  return {
    name,
    ok: true,
    message: [logoNote, tagNote].filter(Boolean).join('；') || undefined,
  }
}
