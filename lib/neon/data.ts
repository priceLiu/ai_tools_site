import { getNeonSql } from '@/lib/neon/sql'
import {
  mapCommentRow,
  mapProfileRow,
  mapToolRow,
  parseCategoryJson,
} from '@/lib/neon/mappers'
import type {
  Category,
  NavigationMenuItemRow,
  Profile,
  Tool,
  ToolComment,
} from '@/lib/types'
import type { IntroductionFormat } from '@/lib/introduction-format'
import { toolIntroductionPreviewDedup } from '@/lib/tool-dedup'
import { publicizeToolImages } from '@/lib/public-tool-image-url'

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
    SELECT id, display_name, avatar_url, is_admin, is_disabled, created_at
    FROM profiles
    ORDER BY created_at DESC
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

export async function neonListToolsAdminTab(
  status: 'pending' | 'approved' | 'rejected',
  from: number,
  to: number,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const limit = to - from + 1
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.status = ${status}
    ORDER BY t.created_at DESC
    OFFSET ${from} LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map(rowToTool)
}

export async function neonListToolsAdminSearch(
  pattern: string,
  limit: number,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.name ILIKE ${pattern}
       OR t.description ILIKE ${pattern}
       OR t.slug ILIKE ${pattern}
    ORDER BY t.updated_at DESC
    LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map(rowToTool)
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

export async function neonSetToolTagsForTool(params: {
  actorUserId: string
  actorIsAdmin: boolean
  toolId: string
  names: string[]
}): Promise<{ error?: string }> {
  const sql = getNeonSql()
  const toolRows = await sql`
    SELECT id, user_id FROM tools WHERE id = ${params.toolId} LIMIT 1
  `
  const tool = toolRows[0] as { id: string; user_id: string | null } | undefined
  if (!tool) return { error: '工具不存在' }
  const owner = tool.user_id
  if (owner !== params.actorUserId && !params.actorIsAdmin) {
    return { error: 'not allowed to set tags for this tool' }
  }

  await sql`DELETE FROM tool_tags WHERE tool_id = ${params.toolId}`

  let order = 0
  const seen = new Set<string>()
  for (const raw of params.names) {
    if (order >= 6) break
    const n = raw.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!n) continue

    const existing = await sql`
      SELECT id FROM tags WHERE lower(trim(name)) = lower(${n}) LIMIT 1
    `
    let tagId: string
    if (existing.length > 0) {
      tagId = String((existing[0] as { id: string }).id)
    } else {
      const ins = await sql`
        INSERT INTO tags (name) VALUES (${n}) RETURNING id
      `
      tagId = String((ins[0] as { id: string }).id)
    }
    if (seen.has(tagId)) continue
    seen.add(tagId)
    await sql`
      INSERT INTO tool_tags (tool_id, tag_id, sort_order)
      VALUES (${params.toolId}, ${tagId}, ${order})
    `
    order += 1
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
}): Promise<void> {
  const sql = getNeonSql()
  await sql`
    INSERT INTO tool_comments (tool_id, body, nickname, email, website)
    VALUES (
      ${input.tool_id},
      ${input.body},
      ${input.nickname},
      ${input.email},
      ${input.website}
    )
  `
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

export async function neonListToolsForUser(
  userId: string,
  opts?: { status?: string },
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows =
    opts?.status != null
      ? await sql`
          SELECT t.*, row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ${userId} AND t.status = ${opts.status}
          ORDER BY t.created_at DESC
        `
      : await sql`
          SELECT t.*, row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ${userId}
          ORDER BY t.created_at DESC
        `
  return (rows as Record<string, unknown>[]).map(rowToTool)
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
      ${v.view_count != null ? Number(v.view_count) : null}
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
}): Promise<void> {
  const sql = getNeonSql()
  if (input.is_admin !== undefined && input.is_disabled !== undefined) {
    await sql`
      UPDATE profiles
      SET is_admin = ${input.is_admin}, is_disabled = ${input.is_disabled}
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
    await sql`
      UPDATE profiles SET is_disabled = ${input.is_disabled} WHERE id = ${input.id}
    `
  }
}

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

export async function neonListToolsIdIntroFormatCategoryName(): Promise<
  {
    id: string
    introduction: string | null
    introduction_format: string | null
    category_name: string | null
  }[]
> {
  const sql = getNeonSql()
  return (await sql`
    SELECT t.id, t.introduction, t.introduction_format, c.name AS category_name
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
  `) as {
    id: string
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
