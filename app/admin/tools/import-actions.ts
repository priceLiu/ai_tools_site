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
import { buildSuggestedToolTagNames } from '@/lib/tool-tags-extract'

export type ImportToolsRowResult = {
  name: string
  ok: boolean
  message?: string
}

export async function importToolsFromDocsJsonAction(input: {
  rawJson: unknown
  categoryId: string
  initialStatus: 'approved' | 'pending'
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

  const categoryId = input.categoryId.trim()
  if (!categoryId) return { ok: false, error: '请选择分类' }

  const categoryName = await neon.neonGetCategoryNameById(categoryId)
  if (categoryName == null) return { ok: false, error: '分类不存在' }

  const parsed = parseDocsToolsJson(input.rawJson)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const items = parsed.items
  if (items.length === 0) return { ok: false, error: '没有可导入的条目' }

  const results: ImportToolsRowResult[] = []
  let imported = 0
  let anyApproved = false

  for (const item of items) {
    const rowRes = await importOneTool({
      item,
      categoryId,
      categoryName,
      userId: user.id,
      status: input.initialStatus,
    })
    results.push(rowRes)
    if (rowRes.ok) {
      imported++
      if (input.initialStatus === 'approved') anyApproved = true
    }
  }

  if (anyApproved) {
    await revalidateHomeToolBundleAction()
    revalidatePath('/category/[slug]', 'page')
  }
  revalidatePath('/admin')

  return { ok: true, results, imported }
}

async function importOneTool(opts: {
  item: DocsToolJsonItem
  categoryId: string
  categoryName: string | null
  userId: string
  status: 'approved' | 'pending'
}): Promise<ImportToolsRowResult> {
  const { item, categoryId, categoryName, userId, status } = opts
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

  const tagNames = buildSuggestedToolTagNames({
    categoryName,
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
