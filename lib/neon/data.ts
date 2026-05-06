import { getNeonSql } from '@/lib/neon/sql'
import {
  mapAdRow,
  mapAdminCommentRow,
  mapAdminTagRow,
  mapCommentRow,
  mapProfileRow,
  mapTagCategoryRow,
  mapToolRow,
  parseCategoryJson,
} from '@/lib/neon/mappers'
import type {
  AdPlacement,
  AdminCommentRow,
  AdminTagRow,
  Category,
  NavigationMenuItemRow,
  Profile,
  TagCategory,
  Tool,
  ToolComment,
} from '@/lib/types'
import type { IntroductionFormat } from '@/lib/introduction-format'
import { toolIntroductionPreviewDedup } from '@/lib/tool-dedup'
import { publicizeToolImages, publicizeToolLogoUrl } from '@/lib/public-tool-image-url'

/** 与首页「最新收录」limit 一致 */
export const HOME_LATEST_MAX = 15

function rowToTool(row: Record<string, unknown>): Tool {
  const cat = parseCategoryJson(row.category)
  const { category: _drop, ...rest } = row
  return mapToolRow(rest as Record<string, unknown>, cat)
}

async function loadToolTagsForTools(
  toolIds: string[],
): Promise<Map<string, Tool['tool_tags']>> {
  const out = new Map<string, Tool['tool_tags']>()
  if (toolIds.length === 0) return out
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tt.tool_id,
           json_agg(
             json_build_object(
               'sort_order', tt.sort_order,
               'tag', json_build_object('id', tg.id, 'name', tg.name)
             )
             ORDER BY tt.sort_order
           ) AS tags_json
    FROM tool_tags tt
    JOIN tags tg ON tg.id = tt.tag_id
    WHERE tt.tool_id = ANY(${toolIds}::uuid[])
    GROUP BY tt.tool_id
  `
  for (const r of rows as { tool_id: string; tags_json: unknown }[]) {
    out.set(String(r.tool_id), r.tags_json as Tool['tool_tags'])
  }
  return out
}

export async function neonListCategoriesAll(): Promise<Category[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT * FROM categories ORDER BY sort_order ASC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    icon: r.icon == null ? null : String(r.icon),
    sort_order: Number(r.sort_order),
    parent_id:
      r.parent_id == null || String(r.parent_id).trim() === ''
        ? null
        : String(r.parent_id),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
  }))
}

export async function neonListNavigationMenuVisible(): Promise<
  {
    id: string
    parent_id: string | null
    label: string
    href: string
    icon_name: string | null
    sort_order: number
    is_visible: boolean
  }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, parent_id, label, href, icon_name, sort_order, is_visible
    FROM navigation_menu_items
    WHERE is_visible = true
    ORDER BY sort_order ASC
  `
  return rows as {
    id: string
    parent_id: string | null
    label: string
    href: string
    icon_name: string | null
    sort_order: number
    is_visible: boolean
  }[]
}

export async function neonListToolsFeaturedHome(): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
      AND t.is_featured = true
    ORDER BY t.view_count DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

export async function neonListToolsLatestHome(): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    ORDER BY t.created_at DESC NULLS LAST
    LIMIT ${HOME_LATEST_MAX}
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

export async function neonListToolsForCategoryIds(
  categoryIds: string[],
): Promise<Tool[]> {
  if (categoryIds.length === 0) return []
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
      AND t.category_id = ANY(${categoryIds}::uuid[])
    ORDER BY t.view_count DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

/**
 * 取工具的 logo 或截图原始字段（含 `data:`），供 `/api/img/tool/[id]/[kind]` 代理。
 */
export async function neonGetToolImageRawById(
  toolId: string,
  kind: 'logo' | 'screenshot',
): Promise<string | null> {
  const sql = getNeonSql()
  const rows =
    kind === 'logo'
      ? await sql`
          SELECT logo_url
          FROM tools
          WHERE id = ${toolId} AND status = 'approved' AND COALESCE(is_disabled, false) = false
          LIMIT 1
        `
      : await sql`
          SELECT screenshot_url AS img
          FROM tools
          WHERE id = ${toolId} AND status = 'approved' AND COALESCE(is_disabled, false) = false
          LIMIT 1
        `
  const r = rows[0] as
    | { logo_url?: string | null; img?: string | null }
    | undefined
  if (!r) return null
  const v = (kind === 'logo' ? r.logo_url : r.img) ?? null
  if (!v) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

/**
 * 全部前台可见的工具 slug；供 `generateStaticParams` 用，体量大时可改为 LIMIT。
 */
export async function neonListApprovedToolSlugs(): Promise<string[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT slug FROM tools
    WHERE status = 'approved' AND COALESCE(is_disabled, false) = false
  `
  return (rows as { slug: string }[])
    .map((r) => (r.slug ?? '').trim())
    .filter((s) => s.length > 0)
}

/** 获取已审核工具列表（用于下拉选择） */
export async function neonListApprovedToolsForSelect(
  limit: number,
): Promise<{ id: string; name: string; slug: string }[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug
    FROM tools
    WHERE status = 'approved' AND COALESCE(is_disabled, false) = false
    ORDER BY view_count DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `
  return (rows as { id: string; name: string; slug: string }[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
  }))
}

export async function neonGetToolPublicBySlug(slug: string): Promise<Tool | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.slug = ${slug}
      AND t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  const tool = publicizeToolImages(rowToTool(row))
  const tagMap = await loadToolTagsForTools([tool.id])
  const tags = tagMap.get(tool.id)
  return tags ? { ...tool, tool_tags: tags } : tool
}

export async function neonIncrementToolViewCount(slug: string): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE tools
    SET
      view_count = COALESCE(view_count, 0) + 1,
      updated_at = now()
    WHERE trim(slug) = trim(${slug})
      AND status = 'approved'
      AND COALESCE(is_disabled, false) = false
  `
}

export async function neonGetProfileById(id: string): Promise<Profile | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT * FROM profiles WHERE id = ${id} LIMIT 1`
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapProfileRow(r) : null
}

export async function neonGetProfileIsDisabled(
  id: string,
): Promise<boolean | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT is_disabled FROM profiles WHERE id = ${id} LIMIT 1
  `
  const r = rows[0] as { is_disabled: boolean } | undefined
  if (!r) return null
  return r.is_disabled === true
}

export async function neonListProfilesForAdmin(): Promise<Profile[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.is_admin,
      p.is_disabled,
      p.created_at,
      p.disabled_reason,
      COALESCE(p.comment_muted, false) AS comment_muted,
      p.comment_mute_reason,
      ac.email AS registration_email
    FROM profiles p
    LEFT JOIN public.auth_credentials ac ON ac.user_id = p.id
    ORDER BY p.created_at DESC
  `
  return (rows as Record<string, unknown>[]).map(mapProfileRow)
}

export async function neonCategorySelectBySlug(
  slug: string,
): Promise<Category | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT * FROM categories WHERE slug = ${slug} LIMIT 1`
  const r = rows[0] as Record<string, unknown> | undefined
  if (!r) return null
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    icon: r.icon == null ? null : String(r.icon),
    sort_order: Number(r.sort_order),
    parent_id:
      r.parent_id == null || String(r.parent_id).trim() === ''
        ? null
        : String(r.parent_id),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
  }
}

export async function neonCategorySelectNameBySlug(
  slug: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT name FROM categories WHERE slug = ${slug} LIMIT 1
  `
  const r = rows[0] as { name: string } | undefined
  return r?.name ?? null
}

export async function neonListCategoryIdParent(): Promise<
  { id: string; parent_id: string | null }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT id, parent_id FROM categories
  `) as { id: string; parent_id: string | null }[]
}

export async function neonSearchToolsPublic(q: string): Promise<Tool[]> {
  const term = `%${q.trim()}%`
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
      AND (t.name ILIKE ${term} OR t.description ILIKE ${term})
    ORDER BY t.view_count DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(rowToTool)
}

export async function neonListFavoritesWithToolsForUser(userId: string): Promise<
  { id: string; created_at: string; tool: Tool }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      f.id,
      f.user_id,
      f.tool_id,
      f.created_at,
      row_to_json(t.*) AS tool_row,
      row_to_json(c.*) AS cat_row
    FROM favorites f
    JOIN tools t ON t.id = f.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at DESC
  `
  const out: { id: string; created_at: string; tool: Tool }[] = []
  for (const r of rows as Record<string, unknown>[]) {
    const toolRaw = r.tool_row as Record<string, unknown> | null
    const catRaw = r.cat_row as Record<string, unknown> | null
    if (!toolRaw?.id) continue
    const cat = catRaw?.id ? parseCategoryJson(catRaw) : null
    const tool = publicizeToolImages(mapToolRow(toolRaw, cat ?? undefined))
    const favCreated =
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? '')
    out.push({ id: String(r.id), created_at: favCreated, tool })
  }
  return out
}

export async function neonListToolCommentsForTool(
  toolId: string,
): Promise<ToolComment[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT * FROM tool_comments
    WHERE tool_id = ${toolId}
      AND COALESCE(is_hidden, false) = false
    ORDER BY created_at ASC
  `
  return (rows as Record<string, unknown>[]).map(mapCommentRow)
}

export async function neonCountToolsByStatus(
  status: 'pending' | 'approved' | 'rejected',
): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n FROM tools WHERE status = ${status}
  `
  return Number((rows[0] as { n: number }).n ?? 0)
}

/**
 * 管理后台 Tab 语义（与 `app/admin/page.tsx` 一一对应）：
 *  - pending  : status='pending'
 *  - approved : status='approved' AND COALESCE(is_disabled,false)=false  ←公网真正可见
 *  - rejected : status='rejected'
 *  - hidden   : status='approved' AND is_disabled=true                    ←已通过但被隐藏
 *
 * 注意：approved 不再混入隐藏的工具（与历史行为相比是 narrow），
 * 隐藏的工具只能在 hidden Tab 里看到 / 还原。
 */
export type AdminToolTab = 'pending' | 'approved' | 'rejected' | 'hidden'

export async function neonCountAdminToolTab(
  tab: AdminToolTab,
): Promise<number> {
  const sql = getNeonSql()
  if (tab === 'pending') {
    const r = await sql`
      SELECT count(*)::int AS n FROM tools WHERE status = 'pending'
    `
    return Number((r[0] as { n: number }).n ?? 0)
  }
  if (tab === 'rejected') {
    const r = await sql`
      SELECT count(*)::int AS n FROM tools WHERE status = 'rejected'
    `
    return Number((r[0] as { n: number }).n ?? 0)
  }
  if (tab === 'hidden') {
    const r = await sql`
      SELECT count(*)::int AS n
      FROM tools
      WHERE status = 'approved' AND is_disabled = true
    `
    return Number((r[0] as { n: number }).n ?? 0)
  }
  const r = await sql`
    SELECT count(*)::int AS n
    FROM tools
    WHERE status = 'approved' AND COALESCE(is_disabled, false) = false
  `
  return Number((r[0] as { n: number }).n ?? 0)
}

/**
 * 管理后台分 tab 列表。
 *
 * 性能：与 `neonListToolsForUser` 同样的 length() 启发式优化 —— SQL 层用
 * `length(logo_url) > 500` 判断 base64 vs HTTPS 链接（HTTPS 都是短链），
 * 配合 Node 层 publicizeToolImages 转代理 URL，跳过 detoast 完整 base64 字段。
 * 详见 `neonListToolsForUser` 头部 v0/v1/v2/v3 演进记录。
 */
export async function neonListToolsAdminTab(
  tab: AdminToolTab,
  from: number,
  to: number,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const limit = to - from + 1

  if (tab === 'hidden') {
    const rows = await sql`
      SELECT
        t.id, t.name, t.slug, t.description, t.website_url,
        CASE WHEN t.logo_url IS NULL THEN NULL
             WHEN length(t.logo_url) > 500 THEN 'data:'
             ELSE t.logo_url
        END AS logo_url,
        CASE WHEN t.screenshot_url IS NULL THEN NULL
             WHEN length(t.screenshot_url) > 500 THEN 'data:'
             ELSE t.screenshot_url
        END AS screenshot_url,
        t.category_id, t.user_id, t.status, t.rejection_reason,
        t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
        t.introduction, t.introduction_format, t.use_cases,
        t.created_at, t.updated_at,
        row_to_json(c.*) AS category
      FROM tools t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.status = 'approved' AND t.is_disabled = true
      ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
      OFFSET ${from} LIMIT ${limit}
    `
    return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
  }

  if (tab === 'approved') {
    const rows = await sql`
      SELECT
        t.id, t.name, t.slug, t.description, t.website_url,
        CASE WHEN t.logo_url IS NULL THEN NULL
             WHEN length(t.logo_url) > 500 THEN 'data:'
             ELSE t.logo_url
        END AS logo_url,
        CASE WHEN t.screenshot_url IS NULL THEN NULL
             WHEN length(t.screenshot_url) > 500 THEN 'data:'
             ELSE t.screenshot_url
        END AS screenshot_url,
        t.category_id, t.user_id, t.status, t.rejection_reason,
        t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
        t.introduction, t.introduction_format, t.use_cases,
        t.created_at, t.updated_at,
        row_to_json(c.*) AS category
      FROM tools t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.status = 'approved' AND COALESCE(t.is_disabled, false) = false
      ORDER BY t.created_at DESC
      OFFSET ${from} LIMIT ${limit}
    `
    return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
  }

  const rows = await sql`
    SELECT
      t.id, t.name, t.slug, t.description, t.website_url,
      CASE WHEN t.logo_url IS NULL THEN NULL
           WHEN length(t.logo_url) > 500 THEN 'data:'
           ELSE t.logo_url
      END AS logo_url,
      CASE WHEN t.screenshot_url IS NULL THEN NULL
           WHEN length(t.screenshot_url) > 500 THEN 'data:'
           ELSE t.screenshot_url
      END AS screenshot_url,
      t.category_id, t.user_id, t.status, t.rejection_reason,
      t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
      t.introduction, t.introduction_format, t.use_cases,
      t.created_at, t.updated_at,
      row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = ${tab}
    ORDER BY t.created_at DESC
    OFFSET ${from} LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

/**
 * 批量更新 tools.is_disabled —— 用于「批量隐藏」「批量还原」。
 * 返回实际被更新的行数。
 */
export async function neonAdminBulkSetToolsDisabled(
  ids: string[],
  disabled: boolean,
): Promise<number> {
  if (!ids.length) return 0
  const sql = getNeonSql()
  const rows = await sql`
    UPDATE tools
    SET is_disabled = ${disabled}, updated_at = now()
    WHERE id = ANY(${ids}::uuid[])
    RETURNING id
  `
  return rows.length
}

export async function neonListToolsAdminSearch(
  pattern: string,
  limit: number,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      t.id, t.name, t.slug, t.description, t.website_url,
      CASE WHEN t.logo_url IS NULL THEN NULL
           WHEN length(t.logo_url) > 500 THEN 'data:'
           ELSE t.logo_url
      END AS logo_url,
      CASE WHEN t.screenshot_url IS NULL THEN NULL
           WHEN length(t.screenshot_url) > 500 THEN 'data:'
           ELSE t.screenshot_url
      END AS screenshot_url,
      t.category_id, t.user_id, t.status, t.rejection_reason,
      t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
      t.introduction, t.introduction_format, t.use_cases,
      t.created_at, t.updated_at,
      row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.name ILIKE ${pattern}
       OR t.description ILIKE ${pattern}
       OR t.slug ILIKE ${pattern}
    ORDER BY t.updated_at DESC
    LIMIT ${limit}
  `
  // 同 neonListToolsAdminTab：length() 启发式裁掉 base64 + Node 层 publicize 代理 URL
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

export async function neonListStatsCategories(): Promise<Category[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, parent_id, slug, sort_order, icon, created_at
    FROM categories
    ORDER BY sort_order ASC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    icon: r.icon == null ? null : String(r.icon),
    sort_order: Number(r.sort_order),
    parent_id:
      r.parent_id == null || String(r.parent_id).trim() === ''
        ? null
        : String(r.parent_id),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
  }))
}

export async function neonListStatsTools(): Promise<
  {
    id: string
    category_id: string | null
    is_featured: boolean
    status: string
    is_disabled: boolean | null
  }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT id, category_id, is_featured, status, is_disabled
    FROM tools
  `) as {
    id: string
    category_id: string | null
    is_featured: boolean
    status: string
    is_disabled: boolean | null
  }[]
}

export async function neonGetCategoryNameById(
  id: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT name FROM categories WHERE id = ${id} LIMIT 1`
  return (rows[0] as { name: string } | undefined)?.name ?? null
}

export async function neonCategoryExistsById(id: string): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`SELECT 1 FROM categories WHERE id = ${id} LIMIT 1`
  return rows.length > 0
}

export async function neonGetToolAdminMetaById(
  toolId: string,
): Promise<{ id: string; slug: string; status: string } | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, slug, status FROM tools WHERE id = ${toolId} LIMIT 1
  `
  const r = rows[0] as
    | { id: string; slug: string; status: string }
    | undefined
  return r ?? null
}

/**
 * 写入工具标签（覆盖式：先 DELETE 再 INSERT）。
 *
 * 性能历史（2026-05-06）：原实现是 N+1 模式 — 每个标签都要 3 次往返
 *   (SELECT 看是否存在 → INSERT 新 tag → INSERT tool_tags 关联)
 * 加上前面的 owner 校验 + DELETE，20 个标签 = 60+ 次串行往返。
 * 在 CloudBase Run（公网出口）→ 腾讯 PG（公网入口）的链路上每次往返 ~50–150ms，
 * 整体提交工具表现成 5–15 秒「卡顿」。
 *
 * 现在改成 4 次批量往返：
 *   1. SELECT tools 验证 owner
 *   2. SELECT tags 一次性查所有已存在的小写名 → id 映射
 *   3. INSERT tags 一次性批量插入缺失的小写名 → 用 unnest 拆开数组
 *   4. DELETE tool_tags + INSERT tool_tags（用 unnest 一次性 INSERT 全部 (tool_id, tag_id, sort_order)）
 * 实测从 5–15 秒压到 < 500ms。
 */
export async function neonSetToolTagsForTool(params: {
  actorUserId: string
  actorIsAdmin: boolean
  toolId: string
  names: string[]
}): Promise<{ error?: string }> {
  const sql = getNeonSql()

  // 1) Owner / admin 校验
  const toolRows = await sql`
    SELECT id, user_id FROM tools WHERE id = ${params.toolId} LIMIT 1
  `
  const tool = toolRows[0] as { id: string; user_id: string | null } | undefined
  if (!tool) return { error: '工具不存在' }
  if (tool.user_id !== params.actorUserId && !params.actorIsAdmin) {
    return { error: 'not allowed to set tags for this tool' }
  }

  // 规范化 + 按 lower-name 去重，最多保留 20 个；保持原始大小写用于新建
  const orderedNames: string[] = []
  const seenLower = new Set<string>()
  for (const raw of params.names) {
    const n = raw.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!n) continue
    const k = n.toLowerCase()
    if (seenLower.has(k)) continue
    seenLower.add(k)
    orderedNames.push(n)
    if (orderedNames.length >= 20) break
  }

  // 边界：没有标签直接清空
  if (orderedNames.length === 0) {
    await sql`DELETE FROM tool_tags WHERE tool_id = ${params.toolId}`
    return {}
  }

  const lowerNames = orderedNames.map((n) => n.toLowerCase())

  // 2) 一次性查现有标签：lname (trim+lower 后的名字) → id
  const existingRows = await sql`
    SELECT id, lower(trim(name)) AS lname
    FROM tags
    WHERE lower(trim(name)) = ANY(${lowerNames}::text[])
  `
  const lnameToId = new Map<string, string>()
  for (const row of existingRows as Array<{ id: string; lname: string }>) {
    lnameToId.set(row.lname, String(row.id))
  }

  // 3) 一次性批量 INSERT 缺失的标签（用 unnest 把数组拆成多行）
  const missingNames = orderedNames.filter(
    (n) => !lnameToId.has(n.toLowerCase()),
  )
  if (missingNames.length > 0) {
    const inserted = await sql`
      INSERT INTO tags (name)
      SELECT v FROM unnest(${missingNames}::text[]) AS v
      RETURNING id, lower(trim(name)) AS lname
    `
    for (const row of inserted as Array<{ id: string; lname: string }>) {
      lnameToId.set(row.lname, String(row.id))
    }
  }

  // 按提交顺序构造最终 (tool_id, tag_id, sort_order) 三元组
  const toolIdsArr: string[] = []
  const tagIdsArr: string[] = []
  const ordersArr: number[] = []
  let order = 0
  for (const n of orderedNames) {
    const id = lnameToId.get(n.toLowerCase())
    if (!id) continue
    toolIdsArr.push(params.toolId)
    tagIdsArr.push(id)
    ordersArr.push(order)
    order += 1
  }

  // 4) DELETE 旧关联 + 一次性 INSERT 新关联
  await sql`DELETE FROM tool_tags WHERE tool_id = ${params.toolId}`
  if (tagIdsArr.length > 0) {
    await sql`
      INSERT INTO tool_tags (tool_id, tag_id, sort_order)
      SELECT * FROM unnest(
        ${toolIdsArr}::uuid[],
        ${tagIdsArr}::uuid[],
        ${ordersArr}::int[]
      )
    `
  }

  return {}
}

export async function neonFindDuplicateTool(
  nameKey: string,
  categoryId: string | null,
  introPreview: string,
  excludeToolId: string | null,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows =
    categoryId === null
      ? await sql`
          SELECT id, introduction FROM tools
          WHERE name = ${nameKey} AND category_id IS NULL
        `
      : await sql`
          SELECT id, introduction FROM tools
          WHERE name = ${nameKey} AND category_id = ${categoryId}
        `
  for (const r of rows as { id: string; introduction: string | null }[]) {
    if (excludeToolId && r.id === excludeToolId) continue
    if (
      toolIntroductionPreviewDedup(r.introduction as string | null) ===
      introPreview
    ) {
      return r.id
    }
  }
  return null
}

export async function neonInsertFavorite(
  userId: string,
  toolId: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO favorites (user_id, tool_id)
    SELECT ${userId}, ${toolId}
    WHERE NOT EXISTS (
      SELECT 1 FROM favorites f
      WHERE f.user_id = ${userId} AND f.tool_id = ${toolId}
    )
  `
}

export async function neonDeleteFavorite(
  userId: string,
  toolId: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    DELETE FROM favorites
    WHERE user_id = ${userId} AND tool_id = ${toolId}
  `
}

export async function neonInsertToolComment(input: {
  tool_id: string
  body: string
  nickname: string
  email: string
  website: string | null
  user_id?: string | null
}): Promise<void> {
  const sql = getNeonSql()
  const uid =
    input.user_id != null && String(input.user_id).trim() !== ''
      ? String(input.user_id).trim()
      : null
  await sql`
    INSERT INTO tool_comments (tool_id, body, nickname, email, website, user_id)
    VALUES (
      ${input.tool_id},
      ${input.body},
      ${input.nickname},
      ${input.email},
      ${input.website},
      ${uid}
    )
  `
}

export type AdminCommentVisibilityFilter = 'all' | 'visible' | 'hidden'

export async function neonGetProfileCommentMuted(
  profileId: string,
): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT COALESCE(comment_muted, false) AS m
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1
  `
  const r = rows[0] as { m: boolean } | undefined
  return r?.m === true
}

export async function neonAdminSetProfileCommentMute(input: {
  profileId: string
  muted: boolean
  reason: string | null
}): Promise<void> {
  const sql = getNeonSql()
  const reason =
    input.muted && input.reason?.trim()
      ? input.reason.trim().slice(0, 500)
      : null
  await sql`
    UPDATE profiles
    SET
      comment_muted = ${input.muted},
      comment_mute_reason = ${reason}
    WHERE id = ${input.profileId}
  `
}

export async function neonAdminCommentTotals(): Promise<{
  total: number
  visible: number
  hidden: number
}> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE COALESCE(is_hidden, false) = false)::int AS visible,
      count(*) FILTER (WHERE is_hidden = true)::int AS hidden
    FROM tool_comments
  `
  const r = rows[0] as { total: number; visible: number; hidden: number }
  return {
    total: Number(r?.total ?? 0),
    visible: Number(r?.visible ?? 0),
    hidden: Number(r?.hidden ?? 0),
  }
}

export async function neonAdminCommentCountsByTool(
  limit: number,
): Promise<
  {
    tool_id: string
    name: string
    slug: string
    visible: number
    hidden: number
    total: number
  }[]
> {
  const lim = Math.max(1, Math.min(200, Math.floor(limit)))
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      t.id AS tool_id,
      t.name,
      t.slug,
      count(*) FILTER (WHERE COALESCE(c.is_hidden, false) = false)::int AS visible,
      count(*) FILTER (WHERE c.is_hidden = true)::int AS hidden,
      count(*)::int AS total
    FROM tool_comments c
    INNER JOIN tools t ON t.id = c.tool_id
    GROUP BY t.id
    ORDER BY total DESC NULLS LAST, t.name ASC
    LIMIT ${lim}
  `
  return rows as {
    tool_id: string
    name: string
    slug: string
    visible: number
    hidden: number
    total: number
  }[]
}

export async function neonAdminCommentCountsVisibleByCategory(): Promise<
  { category_id: string | null; category_name: string; count: number }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      cat.id AS category_id,
      cat.name AS category_name,
      count(c.id)::int AS count
    FROM tool_comments c
    INNER JOIN tools t ON t.id = c.tool_id
    LEFT JOIN categories cat ON cat.id = t.category_id
    WHERE COALESCE(c.is_hidden, false) = false
    GROUP BY cat.id, cat.name
    ORDER BY count DESC NULLS LAST, category_name ASC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map((row) => ({
    category_id:
      row.category_id == null ? null : String(row.category_id),
    category_name:
      row.category_name == null || String(row.category_name).trim() === ''
        ? '未分类'
        : String(row.category_name),
    count: Number(row.count ?? 0),
  }))
}

export async function neonAdminListCommentsCount(opts: {
  q: string
  visibility: AdminCommentVisibilityFilter
}): Promise<number> {
  const sql = getNeonSql()
  const q = opts.q.trim()
  const pattern = `%${q}%`
  const vis = opts.visibility

  if (vis === 'all' && q === '') {
    const rows = await sql`
      SELECT count(*)::int AS n FROM tool_comments c
    `
    return Number((rows[0] as { n: number })?.n ?? 0)
  }
  if (vis === 'all' && q !== '') {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM tool_comments c
      WHERE c.body ILIKE ${pattern}
        OR c.nickname ILIKE ${pattern}
        OR c.email ILIKE ${pattern}
    `
    return Number((rows[0] as { n: number })?.n ?? 0)
  }
  if (vis === 'visible' && q === '') {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM tool_comments c
      WHERE COALESCE(c.is_hidden, false) = false
    `
    return Number((rows[0] as { n: number })?.n ?? 0)
  }
  if (vis === 'visible' && q !== '') {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM tool_comments c
      WHERE COALESCE(c.is_hidden, false) = false
        AND (
          c.body ILIKE ${pattern}
          OR c.nickname ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
        )
    `
    return Number((rows[0] as { n: number })?.n ?? 0)
  }
  if (vis === 'hidden' && q === '') {
    const rows = await sql`
      SELECT count(*)::int AS n FROM tool_comments c WHERE c.is_hidden = true
    `
    return Number((rows[0] as { n: number })?.n ?? 0)
  }
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM tool_comments c
    WHERE c.is_hidden = true
      AND (
        c.body ILIKE ${pattern}
        OR c.nickname ILIKE ${pattern}
        OR c.email ILIKE ${pattern}
      )
  `
  return Number((rows[0] as { n: number })?.n ?? 0)
}

export async function neonAdminListComments(opts: {
  q: string
  visibility: AdminCommentVisibilityFilter
  limit: number
  offset: number
}): Promise<AdminCommentRow[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(opts.limit)))
  const offset = Math.max(0, Math.floor(opts.offset))
  const sql = getNeonSql()
  const q = opts.q.trim()
  const pattern = `%${q}%`
  const vis = opts.visibility

  let rows: Record<string, unknown>[]

  if (vis === 'all' && q === '') {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (vis === 'all' && q !== '') {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      WHERE c.body ILIKE ${pattern}
        OR c.nickname ILIKE ${pattern}
        OR c.email ILIKE ${pattern}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (vis === 'visible' && q === '') {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      WHERE COALESCE(c.is_hidden, false) = false
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (vis === 'visible' && q !== '') {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      WHERE COALESCE(c.is_hidden, false) = false
        AND (
          c.body ILIKE ${pattern}
          OR c.nickname ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
        )
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (vis === 'hidden' && q === '') {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      WHERE c.is_hidden = true
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else {
    rows = await sql`
      SELECT c.*, t.name AS tool_name, t.slug AS tool_slug
      FROM tool_comments c
      INNER JOIN tools t ON t.id = c.tool_id
      WHERE c.is_hidden = true
        AND (
          c.body ILIKE ${pattern}
          OR c.nickname ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
        )
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }

  return rows.map(mapAdminCommentRow)
}

export async function neonAdminSetCommentHidden(
  commentId: string,
  hidden: boolean,
): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    UPDATE tool_comments
    SET is_hidden = ${hidden}
    WHERE id = ${commentId}
    RETURNING id
  `
  return rows.length > 0
}

export async function neonAdminSearchProfilesForCommentMute(
  q: string,
  limit: number,
): Promise<Profile[]> {
  const sq = q.trim()
  if (sq.length < 2) return []
  const lim = Math.max(1, Math.min(50, Math.floor(limit)))
  const pattern = `%${sq}%`
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.is_admin,
      p.is_disabled,
      p.created_at,
      p.disabled_reason,
      COALESCE(p.comment_muted, false) AS comment_muted,
      p.comment_mute_reason,
      ac.email AS registration_email
    FROM profiles p
    LEFT JOIN public.auth_credentials ac ON ac.user_id = p.id
    WHERE ac.email ILIKE ${pattern}
      OR p.display_name ILIKE ${pattern}
    ORDER BY ac.email ASC NULLS LAST
    LIMIT ${lim}
  `
  return (rows as Record<string, unknown>[]).map(mapProfileRow)
}

export async function neonListProfilesCommentMutedRecent(
  limit: number,
): Promise<Profile[]> {
  const lim = Math.max(1, Math.min(100, Math.floor(limit)))
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      p.id,
      p.display_name,
      p.avatar_url,
      p.is_admin,
      p.is_disabled,
      p.created_at,
      p.disabled_reason,
      COALESCE(p.comment_muted, false) AS comment_muted,
      p.comment_mute_reason,
      ac.email AS registration_email
    FROM profiles p
    LEFT JOIN public.auth_credentials ac ON ac.user_id = p.id
    WHERE COALESCE(p.comment_muted, false) = true
    ORDER BY p.created_at DESC
    LIMIT ${lim}
  `
  return (rows as Record<string, unknown>[]).map(mapProfileRow)
}

export async function neonCountProfilesCommentMuted(): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM profiles
    WHERE COALESCE(comment_muted, false) = true
  `
  return Number((rows[0] as { n: number })?.n ?? 0)
}

export async function neonUpdateProfileFields(
  userId: string,
  patch: { display_name?: string | null; avatar_url?: string | null },
): Promise<void> {
  const sql = getNeonSql()
  if (patch.display_name !== undefined && patch.avatar_url !== undefined) {
    await sql`
      UPDATE profiles
      SET display_name = ${patch.display_name}, avatar_url = ${patch.avatar_url}
      WHERE id = ${userId}
    `
    return
  }
  if (patch.display_name !== undefined) {
    await sql`
      UPDATE profiles SET display_name = ${patch.display_name} WHERE id = ${userId}
    `
  }
  if (patch.avatar_url !== undefined) {
    await sql`
      UPDATE profiles SET avatar_url = ${patch.avatar_url} WHERE id = ${userId}
    `
  }
}

export async function neonUpdateToolFeatured(
  toolId: string,
  isFeatured: boolean,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE tools
    SET is_featured = ${isFeatured}, updated_at = now()
    WHERE id = ${toolId}
  `
}

export async function neonUpdateToolDisabled(
  toolId: string,
  isDisabled: boolean,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE tools
    SET is_disabled = ${isDisabled}, updated_at = now()
    WHERE id = ${toolId}
  `
}

export async function neonGetToolIdUserStatus(
  toolId: string,
): Promise<{ user_id: string | null; status: string } | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT user_id, status FROM tools WHERE id = ${toolId} LIMIT 1
  `
  const r = rows[0] as
    | { user_id: string | null; status: string }
    | undefined
  return r ?? null
}

/**
 * 用户「我的提交」列表。
 *
 * 性能历史（2026-05-06）：
 *
 *   v0：SELECT t.* + 直接 inline data URL 渲染。
 *       170 个工具 = 5.85 MB JSON 从 PG 拉到 Node、再 5.85 MB HTML 给浏览器。
 *       本地 dev 跨公网 14 秒；生产 CloudBase Run 同地域估 3-5 秒。
 *
 *   v1：rowToTool 后 .map(publicizeToolImages) — 只省 Node→浏览器（5.85MB→482KB）。
 *       PG→Node 还是 5.85 MB。本地 ~14 秒（PG→Node 没省）。
 *
 *   v2：SQL 层 CASE WHEN logo_url LIKE 'data:%' 换成 'data:'。
 *       JSON 降到 464KB ✅，但 LIKE 'data:%' 仍触发 PG detoast 整 1.4MB 字段，
 *       170 行总 7.3 秒，CPU 浪费在 detoast 上。
 *
 *   v3（当前）：用 `length(logo_url) <= 500` 启发式判断。
 *       PG 通过 TOAST 元数据可秒查长度而无需 detoast 字段内容。HTTPS URL 都是短链
 *       （≤ 500 字节）原样返回；base64 都是长串（> 500 字节）→ 占位 'data:'。
 *       本地 0.67 秒（21× 提速）；生产同地域 < 200ms。
 *
 *   `publicizeToolImages` 拿到 'data:' 仍能识别（startsWith 检查）→ 替换为
 *   `/api/img/tool/<id>/logo?v=...` 代理 URL，浏览器并行 fetch + 1 年 immutable cache。
 *
 *   `neonGetToolForSubmitEdit` 仍保留原始 data URL（编辑表单需要预览），见
 *   `lib/public-tool-image-url.ts` 头部注释。
 */
export async function neonListToolsForUser(
  userId: string,
  opts?: { status?: string },
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows =
    opts?.status != null
      ? await sql`
          SELECT
            t.id, t.name, t.slug, t.description, t.website_url,
            CASE WHEN t.logo_url IS NULL THEN NULL
                 WHEN length(t.logo_url) > 500 THEN 'data:'
                 ELSE t.logo_url
            END AS logo_url,
            CASE WHEN t.screenshot_url IS NULL THEN NULL
                 WHEN length(t.screenshot_url) > 500 THEN 'data:'
                 ELSE t.screenshot_url
            END AS screenshot_url,
            t.category_id, t.user_id, t.status, t.rejection_reason,
            t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
            t.introduction, t.introduction_format, t.use_cases,
            t.created_at, t.updated_at,
            row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ${userId} AND t.status = ${opts.status}
          ORDER BY t.created_at DESC
        `
      : await sql`
          SELECT
            t.id, t.name, t.slug, t.description, t.website_url,
            CASE WHEN t.logo_url IS NULL THEN NULL
                 WHEN length(t.logo_url) > 500 THEN 'data:'
                 ELSE t.logo_url
            END AS logo_url,
            CASE WHEN t.screenshot_url IS NULL THEN NULL
                 WHEN length(t.screenshot_url) > 500 THEN 'data:'
                 ELSE t.screenshot_url
            END AS screenshot_url,
            t.category_id, t.user_id, t.status, t.rejection_reason,
            t.is_featured, t.is_disabled, t.view_count, t.favorite_count,
            t.introduction, t.introduction_format, t.use_cases,
            t.created_at, t.updated_at,
            row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ${userId}
          ORDER BY t.created_at DESC
        `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

export async function neonGetToolForSubmitEdit(
  toolId: string,
  userId: string,
): Promise<Tool | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.id = ${toolId} AND t.user_id = ${userId}
    LIMIT 1
  `
  const base = rows[0] as Record<string, unknown> | undefined
  if (!base) return null
  const tool = rowToTool(base)
  const tagMap = await loadToolTagsForTools([tool.id])
  const tags = tagMap.get(tool.id)
  return tags ? { ...tool, tool_tags: tags } : tool
}

export async function neonGetToolViewCount(toolId: string): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT view_count FROM tools WHERE id = ${toolId} LIMIT 1
  `
  return Number((rows[0] as { view_count: number | null } | undefined)?.view_count ?? 0)
}

/**
 * 详情页客户端拉真实 view/favorite 计数：详情页 HTML 走 60s ISR，可能比 DB 旧；
 * 这个接口给客户端在挂载后纠正。返回 null 表示工具不存在/已下架。
 *
 * `favorite_count` 不直接读 `tools.favorite_count` 列（部分历史 schema 可能缺失或被禁用），
 * 改为对 `favorites` 实时计数；走 `tool_id` 索引，开销可忽略。
 */
export async function neonGetToolPublicStatsBySlug(
  slug: string,
): Promise<{ view_count: number; favorite_count: number } | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      t.id,
      COALESCE(t.view_count, 0) AS view_count,
      COALESCE(
        (SELECT count(*)::int FROM favorites f WHERE f.tool_id = t.id),
        0
      ) AS favorite_count
    FROM tools t
    WHERE t.slug = ${slug}
      AND t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    LIMIT 1
  `
  const r = rows[0] as
    | { view_count: number | null; favorite_count: number | null }
    | undefined
  if (!r) return null
  return {
    view_count: Number(r.view_count ?? 0),
    favorite_count: Number(r.favorite_count ?? 0),
  }
}

export async function neonApproveTool(input: {
  toolId: string
  featured: boolean
  setViewCount?: number
}): Promise<void> {
  const sql = getNeonSql()
  if (input.setViewCount !== undefined) {
    if (input.featured) {
      await sql`
        UPDATE tools
        SET
          status = 'approved',
          is_disabled = false,
          rejection_reason = null,
          is_featured = true,
          view_count = ${input.setViewCount},
          updated_at = now()
        WHERE id = ${input.toolId}
      `
    } else {
      await sql`
        UPDATE tools
        SET
          status = 'approved',
          is_disabled = false,
          rejection_reason = null,
          view_count = ${input.setViewCount},
          updated_at = now()
        WHERE id = ${input.toolId}
      `
    }
    return
  }
  if (input.featured) {
    await sql`
      UPDATE tools
      SET
        status = 'approved',
        is_disabled = false,
        rejection_reason = null,
        is_featured = true,
        updated_at = now()
      WHERE id = ${input.toolId}
    `
    return
  }
  await sql`
    UPDATE tools
    SET
      status = 'approved',
      is_disabled = false,
      rejection_reason = null,
      updated_at = now()
    WHERE id = ${input.toolId}
  `
}

export async function neonRejectTool(
  toolId: string,
  rejectionReason: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE tools
    SET
      status = 'rejected',
      rejection_reason = ${rejectionReason},
      updated_at = now()
    WHERE id = ${toolId}
  `
}

export async function neonInsertCategory(input: {
  name: string
  slug: string
  parent_id: string
  sort_order: number
  icon: string | null
}): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO categories (name, slug, parent_id, sort_order, icon)
    VALUES (
      ${input.name},
      ${input.slug},
      ${input.parent_id},
      ${input.sort_order},
      ${input.icon}
    )
  `
}

export async function neonUpdateNavigationItemHref(
  id: string,
  href: string,
  updatedAtIso: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE navigation_menu_items
    SET href = ${href}, updated_at = ${updatedAtIso}::timestamptz
    WHERE id = ${id}
  `
}

export async function neonListNavigationAllHrefIdParent(): Promise<
  { id: string; parent_id: string | null; href: string }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT id, parent_id, href FROM navigation_menu_items
  `) as { id: string; parent_id: string | null; href: string }[]
}

export async function neonListNavigationHrefs(): Promise<{ href: string }[]> {
  const sql = getNeonSql()
  return (await sql`SELECT href FROM navigation_menu_items`) as {
    href: string
  }[]
}

export async function neonGetCategoryIdBySlug(
  slug: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT id FROM categories WHERE slug = ${slug} LIMIT 1`
  return (rows[0] as { id: string } | undefined)?.id ?? null
}

export async function neonCountToolsInCategory(
  categoryId: string,
): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n FROM tools WHERE category_id = ${categoryId}
  `
  return Number((rows[0] as { n: number }).n ?? 0)
}

export async function neonCountChildCategories(
  parentId: string,
): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n FROM categories WHERE parent_id = ${parentId}
  `
  return Number((rows[0] as { n: number }).n ?? 0)
}

export async function neonDeleteCategoryById(id: string): Promise<void> {
  const sql = getNeonSql()
  await sql`DELETE FROM categories WHERE id = ${id}`
}

export async function neonAdminUpdateToolFull(
  toolId: string,
  patch: {
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
  },
): Promise<void> {
  const sql = getNeonSql()
  if (typeof patch.is_disabled === 'boolean') {
    await sql`
      UPDATE tools
      SET
        name = ${patch.name},
        description = ${patch.description},
        website_url = ${patch.website_url},
        logo_url = ${patch.logo_url},
        screenshot_url = ${patch.screenshot_url},
        introduction = ${patch.introduction},
        introduction_format = ${patch.introduction_format},
        category_id = ${patch.category_id},
        is_disabled = ${patch.is_disabled},
        updated_at = ${patch.updated_at}::timestamptz
      WHERE id = ${toolId}
    `
    return
  }
  await sql`
    UPDATE tools
    SET
      name = ${patch.name},
      description = ${patch.description},
      website_url = ${patch.website_url},
      logo_url = ${patch.logo_url},
      screenshot_url = ${patch.screenshot_url},
      introduction = ${patch.introduction},
      introduction_format = ${patch.introduction_format},
      category_id = ${patch.category_id},
      updated_at = ${patch.updated_at}::timestamptz
    WHERE id = ${toolId}
  `
}

export async function neonAdminDeleteToolsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const sql = getNeonSql()
  /** 部分库上 tool_tags 等 FK 未设 ON DELETE CASCADE，先删子表再删 tools */
  await sql`DELETE FROM tool_tags WHERE tool_id = ANY(${ids}::uuid[])`
  await sql`DELETE FROM favorites WHERE tool_id = ANY(${ids}::uuid[])`
  await sql`DELETE FROM tool_comments WHERE tool_id = ANY(${ids}::uuid[])`
  const rows = await sql`
    DELETE FROM tools WHERE id = ANY(${ids}::uuid[]) RETURNING id
  `
  return rows.length
}

export async function neonListToolsByIdsMeta(
  ids: string[],
): Promise<{ id: string; slug: string; status: string }[]> {
  if (ids.length === 0) return []
  const sql = getNeonSql()
  return (await sql`
    SELECT id, slug, status FROM tools WHERE id = ANY(${ids}::uuid[])
  `) as { id: string; slug: string; status: string }[]
}

export async function neonSubmitUpdateTool(input: {
  toolId: string
  userId: string
  values: Record<string, unknown>
}): Promise<void> {
  const sql = getNeonSql()
  const v = input.values
  await sql`
    UPDATE tools
    SET
      name = ${v.name as string},
      description = ${v.description as string},
      introduction = ${v.introduction as string},
      introduction_format = ${v.introduction_format as string},
      website_url = ${v.website_url as string},
      category_id = ${(v.category_id as string | null) ?? null},
      logo_url = ${(v.logo_url as string | null) ?? null},
      screenshot_url = ${(v.screenshot_url as string | null) ?? null},
      status = ${v.status as string},
      rejection_reason = ${(v.rejection_reason as string | null) ?? null},
      updated_at = ${v.updated_at as string}::timestamptz
    WHERE id = ${input.toolId} AND user_id = ${input.userId}
  `
}

export async function neonSubmitInsertTool(input: {
  values: Record<string, unknown>
}): Promise<string> {
  const sql = getNeonSql()
  const v = input.values
  const rows = await sql`
    INSERT INTO tools (
      name, slug, description, introduction, introduction_format,
      website_url, category_id, logo_url, screenshot_url,
      user_id, status, is_disabled, rejection_reason, use_cases, view_count
    )
    VALUES (
      ${v.name as string},
      ${v.slug as string},
      ${v.description as string},
      ${v.introduction as string},
      ${v.introduction_format as string},
      ${v.website_url as string},
      ${(v.category_id as string | null) ?? null},
      ${(v.logo_url as string | null) ?? null},
      ${(v.screenshot_url as string | null) ?? null},
      ${v.user_id as string},
      ${v.status as string},
      ${v.is_disabled != null ? Boolean(v.is_disabled) : false},
      ${(v.rejection_reason as string | null) ?? null},
      ${(v.use_cases as string | null) ?? null},
      ${v.view_count != null ? Number(v.view_count) : 0}
    )
    RETURNING id
  `
  return String((rows[0] as { id: string }).id)
}

export async function neonGetProfileIsAdmin(userId: string): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT is_admin FROM profiles WHERE id = ${userId} LIMIT 1
  `
  const r = rows[0] as { is_admin: boolean } | undefined
  return Boolean(r?.is_admin)
}

export async function neonListNavigationForAdmin(): Promise<
  NavigationMenuItemRow[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT * FROM navigation_menu_items ORDER BY sort_order ASC
  `) as unknown as NavigationMenuItemRow[]
}

export async function neonInsertNavigationItem(
  input: Record<string, unknown>,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO navigation_menu_items (parent_id, label, href, icon_name, sort_order, is_visible)
    VALUES (
      ${(input.parent_id as string | null) ?? null},
      ${input.label as string},
      ${(input.href as string) ?? '#'},
      ${(input.icon_name as string | null) ?? null},
      ${Number(input.sort_order ?? 0)},
      ${input.is_visible != null ? Boolean(input.is_visible) : true}
    )
  `
}

export async function neonUpdateNavigationItemFull(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE navigation_menu_items
    SET
      parent_id = ${(patch.parent_id as string | null) ?? null},
      label = ${patch.label as string},
      href = ${patch.href as string},
      icon_name = ${(patch.icon_name as string | null) ?? null},
      sort_order = ${Number(patch.sort_order)},
      is_visible = ${Boolean(patch.is_visible)},
      updated_at = now()
    WHERE id = ${id}
  `
}

export async function neonDeleteNavigationItem(id: string): Promise<void> {
  const sql = getNeonSql()
  await sql`DELETE FROM navigation_menu_items WHERE id = ${id}`
}

export async function neonListNavigationMenuItemsMinimal(): Promise<
  { id: string; label: string; href: string; parent_id: string | null }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT id, label, href, parent_id FROM navigation_menu_items
  `) as {
    id: string
    label: string
    href: string
    parent_id: string | null
  }[]
}

export async function neonGetNavigationMenuItemById(
  id: string,
): Promise<NavigationMenuItemRow | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT * FROM navigation_menu_items WHERE id = ${id} LIMIT 1`
  const r = rows[0]
  if (!r) return null
  return {
    id: String(r.id),
    parent_id:
      r.parent_id == null || String(r.parent_id).trim() === ''
        ? null
        : String(r.parent_id),
    label: String(r.label),
    href: String(r.href),
    icon_name: r.icon_name == null ? null : String(r.icon_name),
    sort_order: Number(r.sort_order),
    is_visible: Boolean(r.is_visible),
  }
}

export async function neonMergePatchNavigationMenuItem(
  id: string,
  patch: Partial<NavigationMenuItemRow>,
): Promise<void> {
  const cur = await neonGetNavigationMenuItemById(id)
  if (!cur) throw new Error('菜单项不存在')
  const merged = { ...cur, ...patch }
  await neonUpdateNavigationItemFull(id, {
    parent_id: merged.parent_id,
    label: merged.label,
    href: merged.href,
    icon_name: merged.icon_name,
    sort_order: merged.sort_order,
    is_visible: merged.is_visible,
  })
}

export async function neonGetToolNameById(id: string): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT name FROM tools WHERE id = ${id} LIMIT 1`
  return (rows[0]?.name as string | undefined) ?? null
}

export async function neonListToolSlugsForUser(
  userId: string,
  excludeId?: string,
): Promise<{ slug: string }[]> {
  const sql = getNeonSql()
  if (excludeId) {
    return (await sql`
      SELECT slug FROM tools WHERE user_id = ${userId} AND id <> ${excludeId}
    `) as { slug: string }[]
  }
  return (await sql`
    SELECT slug FROM tools WHERE user_id = ${userId}
  `) as { slug: string }[]
}

export async function neonGetToolByIdForOwner(
  toolId: string,
  userId: string,
): Promise<Tool | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.id = ${toolId} AND t.user_id = ${userId}
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? rowToTool(row) : null
}

export async function neonGetToolByIdAdmin(toolId: string): Promise<Tool | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.id = ${toolId}
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  const tool = rowToTool(row)
  const tagMap = await loadToolTagsForTools([tool.id])
  const tags = tagMap.get(tool.id)
  return tags ? { ...tool, tool_tags: tags } : tool
}

export async function neonUpdateProfileAdminFlags(input: {
  id: string
  is_admin?: boolean
  is_disabled?: boolean
  /** 仅在 is_disabled === true 时写入；解除禁用时应在调用方传 false 并清空 */
  disabled_reason?: string | null
}): Promise<void> {
  const sql = getNeonSql()
  if (input.is_admin !== undefined && input.is_disabled !== undefined) {
    const reason =
      input.is_disabled === true
        ? (input.disabled_reason?.trim() ?? null)
        : null
    await sql`
      UPDATE profiles
      SET
        is_admin = ${input.is_admin},
        is_disabled = ${input.is_disabled},
        disabled_reason = ${input.is_disabled ? reason : null}
      WHERE id = ${input.id}
    `
    return
  }
  if (input.is_admin !== undefined) {
    await sql`
      UPDATE profiles SET is_admin = ${input.is_admin} WHERE id = ${input.id}
    `
  }
  if (input.is_disabled !== undefined) {
    const reason =
      input.is_disabled === true
        ? (input.disabled_reason?.trim() ?? null)
        : null
    await sql`
      UPDATE profiles
      SET
        is_disabled = ${input.is_disabled},
        disabled_reason = ${input.is_disabled ? reason : null}
      WHERE id = ${input.id}
    `
  }
}

// `neonAdminDeleteUser` / `neonAdminCountToolsByUser` 已移除：
// 管理员后台不再允许删除用户，避免历史教训：原实现会级联删除该用户提交的全部工具。
// 仅保留「禁用」（`profiles.is_disabled = true` + `disabled_reason`）。

export async function neonGetFavoritePair(
  userId: string,
  toolId: string,
): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT 1 FROM favorites WHERE user_id = ${userId} AND tool_id = ${toolId} LIMIT 1
  `
  return rows.length > 0
}

export async function neonToolIsApprovedVisibleById(
  toolId: string,
): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT 1 FROM tools
    WHERE id = ${toolId}
      AND status = 'approved'
      AND COALESCE(is_disabled, false) = false
    LIMIT 1
  `
  return rows.length > 0
}

export async function neonGetToolNameDescriptionById(
  id: string,
): Promise<{ name: string; description: string | null } | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT name, description FROM tools WHERE id = ${id} LIMIT 1
  `
  const row = rows[0] as { name: string; description: string | null } | undefined
  if (!row) return null
  return {
    name: String(row.name ?? ''),
    description: row.description == null ? null : String(row.description),
  }
}

/**
 * 用于「批量重打标签」：仅返回已审核（status='approved'）且未禁用的工具。
 * 待审核 / 被拒的工具不参与全量重打，避免无意义的数据写入。
 */
export async function neonListToolsIdIntroFormatCategoryName(): Promise<
  {
    id: string
    name: string
    description: string | null
    introduction: string | null
    introduction_format: string | null
    category_name: string | null
  }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT t.id, t.name, t.description, t.introduction, t.introduction_format,
           c.name AS category_name
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = 'approved' AND COALESCE(t.is_disabled, false) = false
  `) as {
    id: string
    name: string
    description: string | null
    introduction: string | null
    introduction_format: string | null
    category_name: string | null
  }[]
}

export async function neonCountProfilesAdmins(): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n FROM profiles WHERE is_admin = true
  `
  return Number((rows[0] as { n: number }).n ?? 0)
}

// =============================================================================
// 广告位 (ad_placements)
// =============================================================================

/** 后台列表（全部状态、全部时段），管理员排序界面使用 */
export async function neonListAdsForAdmin(): Promise<AdPlacement[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT a.id, a.tool_id, a.placement, a.tab_key, a.banner_url, a.price,
      a.starts_at, a.ends_at, a.status, a.rejection_reason, a.sort_order,
      a.submitted_by, a.created_at, a.updated_at,
      t.name AS tool_name, t.slug AS tool_slug,
      t.description AS tool_description, t.logo_url AS tool_logo_url
    FROM ad_placements a
    LEFT JOIN tools t ON t.id = a.tool_id
    ORDER BY a.placement ASC, COALESCE(a.tab_key, '') ASC,
             a.sort_order ASC, a.created_at DESC
  `
  return (rows as Record<string, unknown>[]).map((r) => {
    const ad = mapAdRow(r)
    // banner / logo 都走代理（避免 data: URL 撑爆 RSC payload）；无 logo 时勿填代理 URL，否则会无意义请求 404。
    ad.banner_url = ad.banner_url ? `/api/img/ad/${ad.id}` : null
    if (ad.tool) {
      ad.tool.logo_url = publicizeToolLogoUrl(
        ad.tool_id,
        ad.tool.logo_url,
        undefined,
      )
    }
    return ad
  })
}

/** 前台读取：仅 approved + 在生效期；section1 取每个 tab，section2 取所有 */
export async function neonListActiveAds(opts: {
  placement: 'section1' | 'section2'
  /** section1 限定 tab；section2 不需要 */
  tabKey?: 'A' | 'B' | 'C' | null
  limit: number
}): Promise<AdPlacement[]> {
  const sql = getNeonSql()
  const limit = Math.max(1, Math.min(50, Math.floor(opts.limit)))
  if (opts.placement === 'section1') {
    const rows = await sql`
      SELECT a.id, a.tool_id, a.placement, a.tab_key, a.banner_url, a.price,
        a.starts_at, a.ends_at, a.status, a.rejection_reason, a.sort_order,
        a.submitted_by, a.created_at, a.updated_at,
        t.name AS tool_name, t.slug AS tool_slug,
        t.description AS tool_description, t.logo_url AS tool_logo_url
      FROM ad_placements a
      JOIN tools t ON t.id = a.tool_id
      WHERE a.placement = 'section1'
        AND a.tab_key = ${opts.tabKey ?? 'A'}
        AND a.status = 'approved'
        AND now() BETWEEN a.starts_at AND a.ends_at
        AND COALESCE(t.is_disabled, false) = false
      ORDER BY a.sort_order ASC, a.created_at DESC
      LIMIT ${limit}
    `
    return (rows as Record<string, unknown>[]).map((r) => {
      const ad = mapAdRow(r)
      // banner / logo 都走代理（避免 data: URL 撑爆缓存）；无 logo 时不请求占位代理。
      ad.banner_url = ad.banner_url ? `/api/img/ad/${ad.id}` : null
      if (ad.tool) {
        ad.tool.logo_url = publicizeToolLogoUrl(
          ad.tool_id,
          ad.tool.logo_url,
          undefined,
        )
      }
      return ad
    })
  }
  const rows = await sql`
    SELECT a.id, a.tool_id, a.placement, a.tab_key, a.banner_url, a.price,
      a.starts_at, a.ends_at, a.status, a.rejection_reason, a.sort_order,
      a.submitted_by, a.created_at, a.updated_at,
      t.name AS tool_name, t.slug AS tool_slug,
      t.description AS tool_description, t.logo_url AS tool_logo_url
    FROM ad_placements a
    JOIN tools t ON t.id = a.tool_id
    WHERE a.placement = 'section2'
      AND a.status = 'approved'
      AND now() BETWEEN a.starts_at AND a.ends_at
      AND COALESCE(t.is_disabled, false) = false
    ORDER BY a.sort_order ASC, a.created_at DESC
    LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map((r) => {
    const ad = mapAdRow(r)
    // banner 走代理；无 logo 时不请求占位代理。
    ad.banner_url = ad.banner_url ? `/api/img/ad/${ad.id}` : null
    if (ad.tool) {
      ad.tool.logo_url = publicizeToolLogoUrl(
        ad.tool_id,
        ad.tool.logo_url,
        undefined,
      )
    }
    return ad
  })
}

export async function neonGetAdById(id: string): Promise<AdPlacement | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT a.id, a.tool_id, a.placement, a.tab_key, a.banner_url, a.price,
      a.starts_at, a.ends_at, a.status, a.rejection_reason, a.sort_order,
      a.submitted_by, a.created_at, a.updated_at,
      t.name AS tool_name, t.slug AS tool_slug,
      t.description AS tool_description, t.logo_url AS tool_logo_url
    FROM ad_placements a
    LEFT JOIN tools t ON t.id = a.tool_id
    WHERE a.id = ${id}
    LIMIT 1
  `
  if (!rows.length) return null
  return mapAdRow(rows[0] as Record<string, unknown>)
}

/** 仅返回 banner_url 原值；image proxy 用 */
export async function neonGetAdBannerRawById(
  id: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT banner_url FROM ad_placements WHERE id = ${id} LIMIT 1
  `
  if (!rows.length) return null
  const v = (rows[0] as { banner_url: string | null }).banner_url
  return v == null || String(v).trim() === '' ? null : String(v)
}

export interface AdInsertInput {
  tool_id: string
  placement: 'section1' | 'section2'
  tab_key: 'A' | 'B' | 'C' | null
  banner_url: string | null
  price: number
  starts_at: string
  ends_at: string
  status: AdPlacement['status']
  sort_order: number
  submitted_by: string | null
}

export async function neonInsertAd(input: AdInsertInput): Promise<string> {
  const sql = getNeonSql()
  const rows = await sql`
    INSERT INTO ad_placements (
      tool_id, placement, tab_key, banner_url, price,
      starts_at, ends_at, status, sort_order, submitted_by
    ) VALUES (
      ${input.tool_id},
      ${input.placement},
      ${input.tab_key},
      ${input.banner_url},
      ${input.price},
      ${input.starts_at}::timestamptz,
      ${input.ends_at}::timestamptz,
      ${input.status},
      ${input.sort_order},
      ${input.submitted_by}
    ) RETURNING id
  `
  return String((rows[0] as { id: string }).id)
}

export interface AdUpdateInput {
  id: string
  tool_id?: string
  placement?: 'section1' | 'section2'
  tab_key?: 'A' | 'B' | 'C' | null
  banner_url?: string | null
  price?: number
  starts_at?: string
  ends_at?: string
  status?: AdPlacement['status']
  rejection_reason?: string | null
  sort_order?: number
}

export async function neonUpdateAd(input: AdUpdateInput): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE ad_placements SET
      tool_id            = COALESCE(${input.tool_id ?? null}, tool_id),
      placement          = COALESCE(${input.placement ?? null}, placement),
      tab_key            = CASE WHEN ${input.placement ?? null} IS NULL
                                 THEN tab_key
                                 ELSE ${input.tab_key ?? null}
                            END,
      banner_url         = COALESCE(${input.banner_url ?? null}, banner_url),
      price              = COALESCE(${input.price ?? null}, price),
      starts_at          = COALESCE(${input.starts_at ?? null}::timestamptz, starts_at),
      ends_at            = COALESCE(${input.ends_at ?? null}::timestamptz, ends_at),
      status             = COALESCE(${input.status ?? null}, status),
      rejection_reason   = CASE WHEN ${input.status ?? null} = 'rejected'
                                 THEN ${input.rejection_reason ?? null}
                                 WHEN ${input.status ?? null} IN ('approved','pending')
                                 THEN NULL
                                 ELSE rejection_reason
                            END,
      sort_order         = COALESCE(${input.sort_order ?? null}, sort_order),
      updated_at         = now()
    WHERE id = ${input.id}
  `
}

export async function neonDeleteAd(id: string): Promise<void> {
  const sql = getNeonSql()
  await sql`DELETE FROM ad_placements WHERE id = ${id}`
}

/** 单独更新排序（避免 COALESCE 复杂 null 类型推断问题） */
export async function neonUpdateAdSortOrder(
  id: string,
  sort_order: number,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE ad_placements
    SET sort_order = ${Math.floor(sort_order)}, updated_at = now()
    WHERE id = ${id}
  `
}

/** 单独更新状态（避免复杂 null 类型推断） */
export async function neonUpdateAdStatus(
  id: string,
  status: AdPlacement['status'],
  rejection_reason: string | null,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE ad_placements
    SET status = ${status},
        rejection_reason = ${status === 'rejected' ? rejection_reason : null},
        updated_at = now()
    WHERE id = ${id}
  `
}

/** 检查同一工具在指定时段内、同一 placement 是否已有重叠的 approved 投放（排除自身） */
export async function neonCheckAdOverlap(opts: {
  tool_id: string
  placement: 'section1' | 'section2'
  starts_at: string
  ends_at: string
  exclude_id?: string
}): Promise<boolean> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT 1 FROM ad_placements
    WHERE tool_id = ${opts.tool_id}
      AND placement = ${opts.placement}
      AND status = 'approved'
      AND id != ${opts.exclude_id ?? '00000000-0000-0000-0000-000000000000'}
      AND (
        (starts_at <= ${opts.ends_at}::timestamptz AND ends_at >= ${opts.starts_at}::timestamptz)
      )
    LIMIT 1
  `
  return rows.length > 0
}

export async function neonCountActiveAdsByPlacement(): Promise<{
  section1A: number
  section1B: number
  section1C: number
  section2: number
  pending: number
}> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      placement,
      COALESCE(tab_key, '') AS tab_key,
      status,
      now() BETWEEN starts_at AND ends_at AS in_period,
      count(*)::int AS n
    FROM ad_placements
    GROUP BY placement, COALESCE(tab_key, ''), status, (now() BETWEEN starts_at AND ends_at)
  `
  let section1A = 0
  let section1B = 0
  let section1C = 0
  let section2 = 0
  let pending = 0
  for (const r of rows as {
    placement: string
    tab_key: string
    status: string
    in_period: boolean
    n: number
  }[]) {
    if (r.status === 'pending') pending += Number(r.n)
    if (r.status !== 'approved' || !r.in_period) continue
    if (r.placement === 'section1' && r.tab_key === 'A') section1A += Number(r.n)
    else if (r.placement === 'section1' && r.tab_key === 'B') section1B += Number(r.n)
    else if (r.placement === 'section1' && r.tab_key === 'C') section1C += Number(r.n)
    else if (r.placement === 'section2') section2 += Number(r.n)
  }
  return { section1A, section1B, section1C, section2, pending }
}

// =====================================================================
// 标签管理（/admin/tags）
// =====================================================================

export async function neonListTagCategoriesAll(): Promise<TagCategory[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, description, created_at
    FROM tag_categories
    ORDER BY sort_order ASC, name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapTagCategoryRow)
}

export async function neonGetTagCategoryBySlug(
  slug: string,
): Promise<TagCategory | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, description, created_at
    FROM tag_categories WHERE slug = ${slug} LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapTagCategoryRow(r) : null
}

/**
 * 管理后台：列出全部标签 + 工具数 + 一级分类。
 * 排序：is_curated DESC（curated 在前），同分类内按名称。
 */
export async function neonAdminListTagsAll(): Promise<AdminTagRow[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.id,
           t.name,
           t.tag_category_id,
           t.is_curated,
           t.aliases,
           t.created_at,
           tc.name AS category_name,
           tc.slug AS category_slug,
           COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
             AS tool_count
    FROM tags t
    LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
    ORDER BY t.is_curated DESC,
             COALESCE(tc.sort_order, 999) ASC,
             tc.name NULLS LAST,
             t.name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapAdminTagRow)
}

/**
 * 待清理列表：is_curated = false，按工具数降序、再按名称。
 */
export async function neonAdminListUncuratedTags(): Promise<AdminTagRow[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.id,
           t.name,
           t.tag_category_id,
           t.is_curated,
           t.aliases,
           t.created_at,
           tc.name AS category_name,
           tc.slug AS category_slug,
           COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
             AS tool_count
    FROM tags t
    LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
    WHERE t.is_curated = false
    ORDER BY tool_count DESC, t.name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapAdminTagRow)
}

export async function neonAdminGetTagById(
  id: string,
): Promise<AdminTagRow | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.id,
           t.name,
           t.tag_category_id,
           t.is_curated,
           t.aliases,
           t.created_at,
           tc.name AS category_name,
           tc.slug AS category_slug,
           COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
             AS tool_count
    FROM tags t
    LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
    WHERE t.id = ${id}
    LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapAdminTagRow(r) : null
}

/**
 * 合并：把 source 上所有 tool_tags.tag_id → target.tag_id（保留 sort_order，遇冲突删源），
 * 把 source.name 写入 target.aliases，删除 source。
 *
 * 整体在事务里执行；只允许 source != target。
 */
export async function neonAdminMergeTags(input: {
  sourceTagId: string
  targetTagId: string
}): Promise<{ ok: boolean; error?: string; movedTools: number }> {
  if (input.sourceTagId === input.targetTagId) {
    return { ok: false, error: '不能合并到自身', movedTools: 0 }
  }
  const sql = getNeonSql()
  const src = (
    await sql`SELECT id, name FROM tags WHERE id = ${input.sourceTagId} LIMIT 1`
  )[0] as { id: string; name: string } | undefined
  const dst = (
    await sql`SELECT id, name, aliases FROM tags WHERE id = ${input.targetTagId} LIMIT 1`
  )[0] as { id: string; name: string; aliases: string[] | null } | undefined
  if (!src || !dst) return { ok: false, error: '标签不存在', movedTools: 0 }

  await sql`BEGIN`
  try {
    /** 把 source 上的 tool_tags 转过来；冲突（同 tool 已有 target）的直接删源 */
    const updated = await sql`
      UPDATE tool_tags tt
      SET tag_id = ${input.targetTagId}
      WHERE tt.tag_id = ${input.sourceTagId}
        AND NOT EXISTS (
          SELECT 1 FROM tool_tags x
          WHERE x.tool_id = tt.tool_id AND x.tag_id = ${input.targetTagId}
        )
      RETURNING tool_id
    `
    /** 剩下的（同 tool 已有 target）直接删源 */
    await sql`
      DELETE FROM tool_tags WHERE tag_id = ${input.sourceTagId}
    `
    /** 把 source.name 加入 target.aliases（去重） */
    const newAlias = (src.name ?? '').trim()
    if (newAlias) {
      await sql`
        UPDATE tags
        SET aliases = (
          SELECT array_agg(DISTINCT v)
          FROM unnest(COALESCE(aliases, '{}') || ARRAY[${newAlias}]::text[]) AS v
          WHERE v <> ''
        )
        WHERE id = ${input.targetTagId}
      `
    }
    await sql`DELETE FROM tags WHERE id = ${input.sourceTagId}`
    await sql`COMMIT`
    return { ok: true, movedTools: updated.length }
  } catch (e) {
    try {
      await sql`ROLLBACK`
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : '合并失败',
      movedTools: 0,
    }
  }
}

export async function neonAdminRenameTag(input: {
  tagId: string
  newName: string
}): Promise<{ ok: boolean; error?: string }> {
  const n = input.newName.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!n) return { ok: false, error: '名称不能为空' }
  const sql = getNeonSql()
  /** 命中已有同名标签（lower(trim) 唯一） */
  const dup = await sql`
    SELECT id FROM tags
    WHERE lower(trim(name)) = lower(${n}) AND id <> ${input.tagId}
    LIMIT 1
  `
  if (dup.length > 0) return { ok: false, error: '已存在同名标签，请使用合并' }
  await sql`UPDATE tags SET name = ${n} WHERE id = ${input.tagId}`
  return { ok: true }
}

export async function neonAdminDeleteTag(
  tagId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  const n = (
    await sql`SELECT COUNT(*)::int AS n FROM tool_tags WHERE tag_id = ${tagId}`
  )[0] as { n: number }
  if (n && Number(n.n) > 0) {
    return { ok: false, error: '该标签下仍有工具，请先合并或重打' }
  }
  await sql`DELETE FROM tags WHERE id = ${tagId}`
  return { ok: true }
}

export async function neonAdminSetTagCurated(input: {
  tagId: string
  isCurated: boolean
  tagCategoryId: string | null
}): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE tags
    SET is_curated = ${input.isCurated},
        tag_category_id = ${input.tagCategoryId}
    WHERE id = ${input.tagId}
  `
}

/** 公开：按 tag slug 风格匹配（slug = lower trim 的 tag.name）查标签 */
export async function neonGetTagByName(name: string): Promise<{
  id: string
  name: string
  tag_category_id: string | null
} | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, tag_category_id FROM tags
    WHERE lower(trim(name)) = lower(${name})
    LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  if (!r) return null
  return {
    id: String(r.id),
    name: String(r.name),
    tag_category_id:
      r.tag_category_id == null ? null : String(r.tag_category_id),
  }
}

export async function neonListToolsByTagId(tagId: string): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c) AS category
    FROM tool_tags tt
    JOIN tools t ON t.id = tt.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE tt.tag_id = ${tagId}
      AND t.status = 'approved' AND COALESCE(t.is_disabled, false) = false
    ORDER BY t.is_featured DESC, t.created_at DESC, t.id
  `
  const tools = (rows as Record<string, unknown>[])
    .map(rowToTool)
    .map(publicizeToolImages)
  if (tools.length === 0) return tools
  const tagMap = await loadToolTagsForTools(tools.map((x) => x.id))
  return tools.map((t) => {
    const tags = tagMap.get(t.id)
    return tags ? { ...t, tool_tags: tags } : t
  })
}

export async function neonListToolsByTagCategoryId(
  tagCategoryId: string,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT DISTINCT ON (t.id) t.*, row_to_json(c) AS category
    FROM tool_tags tt
    JOIN tags tg ON tg.id = tt.tag_id
    JOIN tools t ON t.id = tt.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE tg.tag_category_id = ${tagCategoryId}
      AND t.status = 'approved' AND COALESCE(t.is_disabled, false) = false
    ORDER BY t.id, t.is_featured DESC, t.created_at DESC
  `
  const tools = (rows as Record<string, unknown>[])
    .map(rowToTool)
    .map(publicizeToolImages)
  if (tools.length === 0) return tools
  const tagMap = await loadToolTagsForTools(tools.map((x) => x.id))
  return tools
    .map((t) => {
      const tags = tagMap.get(t.id)
      return tags ? { ...t, tool_tags: tags } : t
    })
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })
}

/** 一级分类 → 旗下标签（按工具数降序），用于 /tag-category/[slug] 与首页卡片 chip */
export async function neonListTagsForCategoryWithCounts(
  tagCategoryId: string,
  limit = 100,
): Promise<{ id: string; name: string; tool_count: number }[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.id, t.name,
           COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
             AS tool_count
    FROM tags t
    WHERE t.tag_category_id = ${tagCategoryId}
    ORDER BY tool_count DESC, t.name ASC
    LIMIT ${limit}
  `
  return rows as { id: string; name: string; tool_count: number }[]
}
