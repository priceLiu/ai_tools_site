'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { randomToolViewSeed } from '@/lib/tool-view-seed'
import { setToolTagsAction } from '@/app/actions/tool-tags'
import { toolPublicPath } from '@/lib/tool-public-path'
import type { ToolComment } from '@/lib/types'

/**
 * 工具状态/可见性变更后，把首页 + 详情页 + 分类页 + 标签 / 角色 / 场景模板都推一遍。
 *
 * 历史上只 revalidate 当前 slug 的 `/tool/<slug>`、`/category/[slug]` + 首页 bundle，
 * 但工具上线/下线/置顶都会影响 `/tag-category/[slug]` / `/tag/[slug]` / `/role/[slug]`
 * 的 ISR 缓存（这些页都按 tag 分组聚合工具列表）；如果这里漏了，前台得等 60s ISR
 * 自然过期或管理员手动「生成静态」才能看到改动。
 *
 * 与 `regeneratePublicStaticAction` 保持完全等价的 path 失效集合，避免「自动可用、手动可用，
 * 但表现不一致」的歧义。
 */
async function revalidatePublicAfterToolChange(toolId: string) {
  const meta = await neon.neonGetToolAdminMetaById(toolId)
  if (meta?.slug) {
    revalidatePath(toolPublicPath(meta.slug))
  }
  revalidatePath('/category/[slug]', 'page')
  revalidatePath('/tool/[slug]', 'page')
  revalidatePath('/tag-category/[slug]', 'page')
  revalidatePath('/tag/[slug]', 'page')
  revalidatePath('/role/[slug]', 'page')
  await revalidateHomeToolBundleAction()
}

async function requireAdmin(): Promise<
  { userId: string } | { error: string }
> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }
  const ok = await neon.neonGetProfileIsAdmin(user.id)
  if (!ok) return { error: '无权限' }
  return { userId: user.id }
}

export async function toggleFavoriteAction(
  toolId: string,
  currentlyFavorited: boolean,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  if (currentlyFavorited) {
    await neon.neonDeleteFavorite(user.id, toolId)
  } else {
    await neon.neonInsertFavorite(user.id, toolId)
  }
  return {}
}

export async function adminApproveToolAction(
  toolId: string,
  featured: boolean,
): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const vc = await neon.neonGetToolViewCount(toolId)
  const seed = vc >= 3000 ? undefined : randomToolViewSeed()
  await neon.neonApproveTool({
    toolId,
    featured,
    setViewCount: seed,
  })
  await revalidatePublicAfterToolChange(toolId)
  return {}
}

export async function adminRejectToolAction(
  toolId: string,
  reason: string,
): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }
  const r = reason.trim()
  if (!r) return { error: '请填写拒绝原因' }

  await neon.neonRejectTool(toolId, r)
  await revalidatePublicAfterToolChange(toolId)
  return {}
}

export async function adminSetToolFeaturedAction(
  toolId: string,
  nextFeatured: boolean,
): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  await neon.neonUpdateToolFeatured(toolId, nextFeatured)
  await revalidatePublicAfterToolChange(toolId)
  return {}
}

export async function adminSetToolDisabledAction(
  toolId: string,
  nextDisabled: boolean,
): Promise<{ error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  await neon.neonUpdateToolDisabled(toolId, nextDisabled)
  await revalidatePublicAfterToolChange(toolId)
  return {}
}

export async function updateProfileDisplayNameAction(
  displayName: string | null,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const trimmed = displayName?.trim() || null
  await neon.neonUpdateProfileFields(user.id, { display_name: trimmed })
  return {}
}

export async function updateProfileAvatarUrlAction(
  avatarUrl: string | null,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  await neon.neonUpdateProfileFields(user.id, { avatar_url: avatarUrl })
  return {}
}

export async function listToolCommentsAction(
  toolId: string,
): Promise<{ comments: ToolComment[]; error?: string }> {
  const comments = await neon.neonListToolCommentsForTool(toolId)
  return { comments }
}

export async function insertToolCommentAction(input: {
  tool_id: string
  body: string
  nickname: string
  email: string
  website?: string | null
}): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  const body = input.body.trim()
  const nickname = input.nickname.trim()
  const email = input.email.trim()
  const website = input.website?.trim() || null

  if (body.length < 1 || body.length > 5000) {
    return { error: '评论内容长度无效' }
  }
  if (nickname.length < 1 || nickname.length > 80) {
    return { error: '昵称长度无效' }
  }
  if (email.length < 3 || email.length > 255) {
    return { error: '邮箱长度无效' }
  }
  if (
    website &&
    website.length > 0 &&
    (website.length > 500 || !/^https?:\/\//i.test(website))
  ) {
    return { error: '网站链接无效' }
  }

  const ok = await neon.neonToolIsApprovedVisibleById(input.tool_id)
  if (!ok) return { error: '无法评论该工具' }
  const muted = await neon.neonGetProfileCommentMuted(user.id)
  if (muted) {
    return { error: '您的账号已被禁止发表评论，如有疑问请联系管理员。' }
  }
  await neon.neonInsertToolComment({
    tool_id: input.tool_id,
    body,
    nickname,
    email,
    website: website && website.length > 0 ? website : null,
    user_id: user.id,
  })
  return {}
}

export async function submitToolPersistAction(input: {
  mode: 'create' | 'update'
  editingToolId?: string
  displayName: string
  slugForUpdate?: string
  newSlug?: string
  description: string
  introduction: string
  introduction_format: string
  website_url: string
  category_id: string
  logo_url: string | null
  screenshot_url: string | null
  tagNames: string[]
}): Promise<{ error?: string; toolId?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '未登录' }

  if (input.mode === 'update') {
    if (!input.editingToolId || !input.slugForUpdate) {
      return { error: '缺少工具信息' }
    }
    await neon.neonSubmitUpdateTool({
      toolId: input.editingToolId,
      userId: user.id,
      values: {
        name: input.displayName,
        slug: input.slugForUpdate,
        description: input.description,
        introduction: input.introduction,
        introduction_format: input.introduction_format,
        website_url: input.website_url,
        category_id: input.category_id,
        logo_url: input.logo_url,
        screenshot_url: input.screenshot_url,
        status: 'pending',
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      },
    })
    const tagRes = await setToolTagsAction({
      toolId: input.editingToolId,
      tagNames: input.tagNames,
    })
    if (tagRes.error) return { error: tagRes.error }
    return { toolId: input.editingToolId }
  }

  if (!input.newSlug) return { error: '缺少 slug' }

  const id = await neon.neonSubmitInsertTool({
    values: {
      name: input.displayName,
      slug: input.newSlug,
      description: input.description,
      introduction: input.introduction,
      introduction_format: input.introduction_format,
      website_url: input.website_url,
      category_id: input.category_id,
      logo_url: input.logo_url,
      screenshot_url: input.screenshot_url,
      user_id: user.id,
      status: 'pending',
      is_disabled: false,
      rejection_reason: null,
      use_cases: null,
    },
  })
  const tagRes = await setToolTagsAction({
    toolId: id,
    tagNames: input.tagNames,
  })
  if (tagRes.error) return { error: tagRes.error }
  return { toolId: id }
}
