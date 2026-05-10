import { getNeonSql, neonSqlBegin } from '@/lib/neon/sql'
import {
  mapAdRow,
  mapAdminCommentRow,
  mapAdminTagRow,
  mapCategoryRow,
  mapCommentRow,
  mapProfileRow,
  mapRoleCategoryRow,
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
  PortalSectionConfigEntry,
  Profile,
  RoleCategory,
  TagCategory,
  Tool,
  ToolComment,
  ToolCommentMineRow,
} from '@/lib/types'
import type { IntroductionFormat } from '@/lib/introduction-format'
import { toolIntroductionPreviewDedup } from '@/lib/tool-dedup'
import { publicizeToolImages, publicizeToolLogoUrl } from '@/lib/public-tool-image-url'
import { slugifyTagCategoryName } from '@/lib/tag-category-slug'
import {
  ACCOUNT_FOLLOW_TOOLS_MAX,
  type UserFollowCategoryJoined,
  type UserFollowToolEntry,
} from '@/lib/account-follows-types'
import { neonTagsHasTagCategoryLinkedAtColumn } from '@/lib/neon/tags-linked-at-column'

export type { UserFollowCategoryJoined, UserFollowToolEntry }
export { ACCOUNT_FOLLOW_TOOLS_MAX }

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
               'tag', json_build_object(
                 'id', tg.id,
                 'name', tg.name,
                 'tag_category_id', tg.tag_category_id
               )
             )
             ORDER BY tt.sort_order
           ) AS tags_json
    FROM tool_tags tt
    JOIN tags tg ON tg.id = tt.tag_id
      AND COALESCE(tg.is_disabled, false) = false
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
  return (rows as Record<string, unknown>[]).map(mapCategoryRow)
}

/** 前台：产品线分类下拉、首页 fallback、sitemap 等（不含已禁用）。 */
export async function neonListCategoriesEnabled(): Promise<Category[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT * FROM categories
    WHERE COALESCE(is_disabled, false) = false
    ORDER BY sort_order ASC
  `
  return (rows as Record<string, unknown>[]).map(mapCategoryRow)
}

/** 导航裁剪：指向这些 slug 的 `/category/...` 菜单项不展示。 */
export async function neonListDisabledMenuCategorySlugs(): Promise<string[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT slug FROM categories
    WHERE COALESCE(is_disabled, false) = true
  `
  return (rows as { slug: string }[])
    .map((r) => String(r.slug ?? '').trim())
    .filter((s) => s.length > 0)
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
      AND COALESCE(c.is_disabled, false) = false
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
      AND t.is_featured = true
    ORDER BY t.view_count DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

/** 与首页 `#home-hot`、`neonListToolsFeaturedHome` 条数一致 */
export async function neonCountFeaturedToolsPublicListed(): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM tools t
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
      AND t.is_featured = true
  `
  return Number((rows[0] as { n: number } | undefined)?.n ?? 0)
}

export async function neonListToolsLatestHome(): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
      AND COALESCE(c.is_disabled, false) = false
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    ORDER BY t.created_at DESC NULLS LAST
    LIMIT ${HOME_LATEST_MAX}
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

/**
 * 前台分类 subtree：按 tool_categories 挂载（一工具可多分类）。
 * DISTINCT ON 消除同一工具命中多条 ancestor id 时的重复行。
 */
export async function neonListToolsForCategoryIds(
  categoryIds: string[],
): Promise<Tool[]> {
  if (categoryIds.length === 0) return []
  const sql = getNeonSql()
  const rows = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (t.id)
        t.*,
        row_to_json(c.*) AS category
      FROM tools t
      INNER JOIN tool_categories tc
        ON tc.tool_id = t.id AND tc.category_id = ANY(${categoryIds}::uuid[])
      INNER JOIN categories c_active ON c_active.id = tc.category_id
        AND COALESCE(c_active.is_disabled, false) = false
      LEFT JOIN categories c ON c.id = t.category_id
        AND COALESCE(c.is_disabled, false) = false
      WHERE t.status = 'approved'
        AND COALESCE(t.is_disabled, false) = false
      ORDER BY t.id, t.view_count DESC NULLS LAST
    ) deduped
    ORDER BY view_count DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(rowToTool).map(publicizeToolImages)
}

/** 提交 / 后台改主分类时：保证 junction 含该条（不移除其它产品线挂载）。 */
export async function neonEnsureToolMenuCategoryLink(
  toolId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  const cid =
    categoryId != null && String(categoryId).trim() !== ''
      ? String(categoryId).trim()
      : null
  if (!cid) return
  const sql = getNeonSql()
  await sql`
    INSERT INTO tool_categories (tool_id, category_id, sort_order)
    VALUES (${toolId}, ${cid}, 0)
    ON CONFLICT (tool_id, category_id) DO NOTHING
  `
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
      AND COALESCE(c.is_disabled, false) = false
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
      COALESCE(p.portal_home_enabled, true) AS portal_home_enabled,
      COALESCE(p.portal_disabled_by_admin, false) AS portal_disabled_by_admin,
      p.portal_section_config,
      COALESCE(p.portal_theme, 'default') AS portal_theme,
      p.showcase_slug,
      COALESCE(p.showcase_status, 'none') AS showcase_status,
      p.showcase_title,
      p.showcase_summary,
      p.showcase_requested_at,
      p.showcase_reviewed_at,
      p.showcase_rejection_reason,
      ac.email AS registration_email
    FROM profiles p
    LEFT JOIN public.auth_credentials ac ON ac.user_id = p.id
    ORDER BY p.created_at DESC
  `
  return (rows as Record<string, unknown>[]).map(mapProfileRow)
}

export async function neonCategorySelectBySlug(
  slug: string,
  opts?: { includeDisabled?: boolean },
): Promise<Category | null> {
  const sql = getNeonSql()
  const rows =
    opts?.includeDisabled === true
      ? await sql`SELECT * FROM categories WHERE slug = ${slug} LIMIT 1`
      : await sql`
          SELECT * FROM categories
          WHERE slug = ${slug}
            AND COALESCE(is_disabled, false) = false
          LIMIT 1
        `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapCategoryRow(r) : null
}

export async function neonCategorySelectNameBySlug(
  slug: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT name FROM categories
    WHERE slug = ${slug}
      AND COALESCE(is_disabled, false) = false
    LIMIT 1
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
      AND COALESCE(c.is_disabled, false) = false
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
      AND COALESCE(c.is_disabled, false) = false
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
    SELECT * FROM categories
    ORDER BY sort_order ASC
  `
  return (rows as Record<string, unknown>[]).map(mapCategoryRow)
}

/**
 * 工具统计：在数据库侧聚合 `tools` 全表计数。
 * 避免 `SELECT * FROM tools` 拉全量再在 Node 里 `.length`（易受分页默认值、响应截断、静态壳缓存等影响）。
 */
export async function neonGetAdminStatsToolCounts(): Promise<{
  totalTools: number
  publicListedCount: number
  hiddenApprovedCount: number
  featuredToolsCount: number
  uncategorizedCount: number
  uncategorizedPublicCount: number
}> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_tools,
      COUNT(*) FILTER (
        WHERE status = 'approved' AND (is_disabled IS NOT TRUE)
      )::int AS public_listed,
      COUNT(*) FILTER (
        WHERE status = 'approved' AND is_disabled = true
      )::int AS hidden_approved,
      COUNT(*) FILTER (
        WHERE status = 'approved'
          AND (is_disabled IS NOT TRUE)
          AND is_featured = true
      )::int AS featured,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM tool_categories tc WHERE tc.tool_id = tools.id
        )
      )::int AS uncategorized_all,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM tool_categories tc WHERE tc.tool_id = tools.id
        )
          AND status = 'approved'
          AND (is_disabled IS NOT TRUE)
      )::int AS uncategorized_public
    FROM tools
  `
  const r = rows[0] as {
    total_tools: number
    public_listed: number
    hidden_approved: number
    featured: number
    uncategorized_all: number
    uncategorized_public: number
  }
  return {
    totalTools: Number(r.total_tools),
    publicListedCount: Number(r.public_listed),
    hiddenApprovedCount: Number(r.hidden_approved),
    featuredToolsCount: Number(r.featured),
    uncategorizedCount: Number(r.uncategorized_all),
    uncategorizedPublicCount: Number(r.uncategorized_public),
  }
}

/** 各分类下「已通过且未隐藏」工具数（柱状图；不含 hot 特殊口径）。 */
export async function neonGetAdminStatsPublicToolCountsByCategory(): Promise<
  { category_id: string; n: number }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tc.category_id::text AS category_id,
           COUNT(DISTINCT tc.tool_id)::int AS n
    FROM tool_categories tc
    INNER JOIN categories cat ON cat.id = tc.category_id
      AND COALESCE(cat.is_disabled, false) = false
    INNER JOIN tools t ON t.id = tc.tool_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    GROUP BY tc.category_id
  `
  return (rows as { category_id: string; n: number }[]).map((row) => ({
    category_id: row.category_id,
    n: Number(row.n),
  }))
}

export async function neonGetCategoryNameById(
  id: string,
): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT name FROM categories WHERE id = ${id} LIMIT 1`
  return (rows[0] as { name: string } | undefined)?.name ?? null
}

export async function neonCategorySlugById(id: string): Promise<string | null> {
  const sql = getNeonSql()
  const rows = await sql`SELECT slug FROM categories WHERE id = ${id} LIMIT 1`
  const s = (rows[0] as { slug: string } | undefined)?.slug
  return s != null ? String(s).trim() : null
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
const TAG_CATEGORY_HINT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function neonSetToolTagsForTool(params: {
  actorUserId: string
  actorIsAdmin: boolean
  toolId: string
  names: string[]
  /**
   * 可选（通常仅管理员工具页）：name 小写键 → `tag_categories.id`。
   * `null` 表示明确未归入场景（仅影响本次新建的标签行）。
   * 已有标签：若 hint 为非 null UUID，会**覆盖**写入 `tag_category_id`（标签词条全局一条，
   *   改场景会影响所有挂载该标签的工具）；hint 为 `null` 时仍不会清空已有场景（避免误操作）。
   */
  tagCategoryHints?: Record<string, string | null>
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
  const insertedLowerNames = new Set<string>()
  if (missingNames.length > 0) {
    const inserted = await sql`
      INSERT INTO tags (name)
      SELECT v FROM unnest(${missingNames}::text[]) AS v
      RETURNING id, lower(trim(name)) AS lname
    `
    for (const row of inserted as Array<{ id: string; lname: string }>) {
      lnameToId.set(row.lname, String(row.id))
      insertedLowerNames.add(String(row.lname))
    }
  }

  const hints = params.tagCategoryHints
  if (hints && Object.keys(hints).length > 0) {
    const linkedAtCol = await neonTagsHasTagCategoryLinkedAtColumn()
    for (const n of orderedNames) {
      const lname = n.toLowerCase()
      if (!Object.prototype.hasOwnProperty.call(hints, lname)) continue
      const hintRaw = hints[lname]
      const tagId = lnameToId.get(lname)
      if (!tagId) continue

      let catUuid: string | null = null
      if (hintRaw !== null) {
        const h = hintRaw.trim()
        if (!TAG_CATEGORY_HINT_UUID_RE.test(h)) continue
        catUuid = h.toLowerCase()
      }

      const isNewRow = insertedLowerNames.has(lname)
      if (isNewRow) {
        if (catUuid === null) {
          if (linkedAtCol) {
            await sql`
              UPDATE tags SET tag_category_id = NULL, tag_category_linked_at = now()
              WHERE id = ${tagId}
            `
          } else {
            await sql`
              UPDATE tags SET tag_category_id = NULL WHERE id = ${tagId}
            `
          }
        } else if (linkedAtCol) {
          await sql`
            UPDATE tags SET tag_category_id = ${catUuid}, tag_category_linked_at = now()
            WHERE id = ${tagId}
          `
        } else {
          await sql`
            UPDATE tags SET tag_category_id = ${catUuid} WHERE id = ${tagId}
          `
        }
      } else if (catUuid !== null) {
        if (linkedAtCol) {
          await sql`
            UPDATE tags SET tag_category_id = ${catUuid}, tag_category_linked_at = now()
            WHERE id = ${tagId}
          `
        } else {
          await sql`
            UPDATE tags SET tag_category_id = ${catUuid} WHERE id = ${tagId}
          `
        }
      }
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

const ADMIN_LISTED_TOOL_MAX_TAGS = 20

/**
 * 在已通过且未隐藏的工具上追加标签（不改动 tags 表）。
 * - `tagIdsToAppend` **非空**：仅追加这些 id，且必须 ⊆ allowedTagIds；合并后超过 20 枚则失败。
 * - `tagIdsToAppend` **为空**：按分类挂载——在保留原有顺序的前提下，依次并入 allowedTagIds（顺序见列表查询），直到单工具 20 枚上限。
 */
export async function neonAdminAppendListedToolTags(params: {
  toolId: string
  tagIdsToAppend: string[]
  allowedTagIds: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = getNeonSql()
  const toolId = String(params.toolId).trim().toLowerCase()
  const norm = (x: string) => String(x).trim().toLowerCase()
  const allowedOrdered = params.allowedTagIds.map(norm).filter(Boolean)
  const allowed = new Set(allowedOrdered)

  const explicitAppend = [
    ...new Set(
      params.tagIdsToAppend
        .map(norm)
        .filter(Boolean)
        .filter((id) => allowed.has(id)),
    ),
  ]

  const categoryWideMount = explicitAppend.length === 0
  const appendIds = categoryWideMount ? allowedOrdered : explicitAppend

  if (appendIds.length === 0) {
    return {
      ok: false,
      error: '本分类下没有可用的启用标签，请先到「关联标签」维护词条',
    }
  }

  const toolRows = await sql`
    SELECT id FROM tools
    WHERE id = ${toolId}
      AND status = 'approved'
      AND COALESCE(is_disabled, false) = false
    LIMIT 1
  `
  if (!toolRows[0]) {
    return { ok: false, error: '工具不存在、未审核通过或已隐藏，无法挂载' }
  }

  if (!categoryWideMount) {
    const alive = await sql`
      SELECT id FROM tags
      WHERE id = ANY(${appendIds}::uuid[])
        AND COALESCE(is_disabled, false) = false
    `
    if (alive.length !== appendIds.length) {
      return { ok: false, error: '包含无效或已禁用的标签' }
    }
  }

  const existingRows = await sql`
    SELECT tag_id FROM tool_tags WHERE tool_id = ${toolId} ORDER BY sort_order ASC
  `
  const existing = (existingRows as { tag_id: string }[]).map((r) =>
    String(r.tag_id).trim().toLowerCase(),
  )

  const merged: string[] = [...existing]
  if (categoryWideMount) {
    for (const id of appendIds) {
      if (merged.includes(id)) continue
      if (merged.length >= ADMIN_LISTED_TOOL_MAX_TAGS) break
      merged.push(id)
    }
  } else {
    for (const id of appendIds) {
      if (!merged.includes(id)) merged.push(id)
    }
    if (merged.length > ADMIN_LISTED_TOOL_MAX_TAGS) {
      return {
        ok: false,
        error: `单工具最多 ${ADMIN_LISTED_TOOL_MAX_TAGS} 个标签，合并后将超限，请先到「工具与标签」精简`,
      }
    }
  }

  if (merged.length > 0) {
    const aliveMerged = await sql`
      SELECT id FROM tags
      WHERE id = ANY(${merged}::uuid[])
        AND COALESCE(is_disabled, false) = false
    `
    if (aliveMerged.length !== merged.length) {
      return { ok: false, error: '包含无效或已禁用的标签' }
    }
  }

  const needWrite =
    merged.length !== existing.length ||
    merged.some((id, i) => id !== existing[i])

  if (!needWrite) return { ok: true }

  await sql`DELETE FROM tool_tags WHERE tool_id = ${toolId}`
  const toolIdsArr = merged.map(() => toolId)
  const ordersArr = merged.map((_, i) => i)
  await sql`
    INSERT INTO tool_tags (tool_id, tag_id, sort_order)
    SELECT * FROM unnest(
      ${toolIdsArr}::uuid[],
      ${merged}::uuid[],
      ${ordersArr}::int[]
    )
  `
  return { ok: true }
}

/** 从工具的 tool_tags 中移除归属指定场景的词条（`tags.tag_category_id`，含禁用词条）；不改 tags 表。 */
export async function neonAdminStripSceneTagsFromListedTool(params: {
  toolId: string
  tagCategoryId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = getNeonSql()
  const toolId = String(params.toolId).trim().toLowerCase()
  const cid = String(params.tagCategoryId).trim().toLowerCase()

  const toolRows = await sql`
    SELECT id FROM tools
    WHERE id = ${toolId}
      AND status = 'approved'
      AND COALESCE(is_disabled, false) = false
    LIMIT 1
  `
  if (!toolRows[0]) {
    return { ok: false, error: '工具不存在、未审核通过或已隐藏，无法操作' }
  }

  const removableRows = await sql`
    SELECT id::text AS id FROM tags WHERE tag_category_id = ${cid}
  `
  const removable = new Set(
    (removableRows as { id: string }[]).map((r) =>
      String(r.id).trim().toLowerCase(),
    ),
  )

  const existingRows = await sql`
    SELECT tag_id FROM tool_tags WHERE tool_id = ${toolId} ORDER BY sort_order ASC
  `
  const existing = (existingRows as { tag_id: string }[]).map((r) =>
    String(r.tag_id).trim().toLowerCase(),
  )

  const merged = existing.filter((id) => !removable.has(id))

  const needWrite =
    merged.length !== existing.length ||
    merged.some((id, i) => id !== existing[i])
  if (!needWrite) return { ok: true }

  if (merged.length > 0) {
    const cntRows = await sql`
      SELECT COUNT(*)::int AS n FROM tags WHERE id = ANY(${merged}::uuid[])
    `
    const n = Number((cntRows[0] as { n: number })?.n ?? 0)
    if (n !== merged.length) {
      return { ok: false, error: '包含无效标签' }
    }
  }

  await sql`DELETE FROM tool_tags WHERE tool_id = ${toolId}`
  if (merged.length === 0) return { ok: true }

  const toolIdsArr = merged.map(() => toolId)
  const ordersArr = merged.map((_, i) => i)
  await sql`
    INSERT INTO tool_tags (tool_id, tag_id, sort_order)
    SELECT * FROM unnest(
      ${toolIdsArr}::uuid[],
      ${merged}::uuid[],
      ${ordersArr}::int[]
    )
  `
  return { ok: true }
}

/** 从工具的 tool_tags 中移除本品在 role_category_tags 中的词条链接；不改联结表与 tags。 */
export async function neonAdminStripRoleTagsFromListedTool(params: {
  toolId: string
  roleCategoryId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = getNeonSql()
  const toolId = String(params.toolId).trim().toLowerCase()
  const rid = String(params.roleCategoryId).trim().toLowerCase()

  const toolRows = await sql`
    SELECT id FROM tools
    WHERE id = ${toolId}
      AND status = 'approved'
      AND COALESCE(is_disabled, false) = false
    LIMIT 1
  `
  if (!toolRows[0]) {
    return { ok: false, error: '工具不存在、未审核通过或已隐藏，无法操作' }
  }

  const removableRows = await sql`
    SELECT tag_id::text AS id
    FROM role_category_tags
    WHERE role_category_id = ${rid}
  `
  const removable = new Set(
    (removableRows as { id: string }[]).map((r) =>
      String(r.id).trim().toLowerCase(),
    ),
  )

  const existingRows = await sql`
    SELECT tag_id FROM tool_tags WHERE tool_id = ${toolId} ORDER BY sort_order ASC
  `
  const existing = (existingRows as { tag_id: string }[]).map((r) =>
    String(r.tag_id).trim().toLowerCase(),
  )

  const merged = existing.filter((id) => !removable.has(id))

  const needWrite =
    merged.length !== existing.length ||
    merged.some((id, i) => id !== existing[i])
  if (!needWrite) return { ok: true }

  if (merged.length > 0) {
    const cntRows = await sql`
      SELECT COUNT(*)::int AS n FROM tags WHERE id = ANY(${merged}::uuid[])
    `
    const n = Number((cntRows[0] as { n: number })?.n ?? 0)
    if (n !== merged.length) {
      return { ok: false, error: '包含无效标签' }
    }
  }

  await sql`DELETE FROM tool_tags WHERE tool_id = ${toolId}`
  if (merged.length === 0) return { ok: true }

  const toolIdsArr = merged.map(() => toolId)
  const ordersArr = merged.map((_, i) => i)
  await sql`
    INSERT INTO tool_tags (tool_id, tag_id, sort_order)
    SELECT * FROM unnest(
      ${toolIdsArr}::uuid[],
      ${merged}::uuid[],
      ${ordersArr}::int[]
    )
  `
  return { ok: true }
}

/** 场景分类下未禁用标签 id（挂载工具时的白名单顺序：按词条名） */
export async function neonAdminListEnabledTagIdsInSceneCategory(
  tagCategoryId: string,
): Promise<string[]> {
  const sql = getNeonSql()
  const cid = String(tagCategoryId).trim().toLowerCase()
  const rows = await sql`
    SELECT id::text AS id FROM tags
    WHERE tag_category_id = ${cid}
      AND COALESCE(is_disabled, false) = false
    ORDER BY lower(trim(name)) ASC
  `
  return (rows as { id: string }[]).map((r) => String(r.id).trim().toLowerCase())
}

/** 角色分类已关联的未禁用标签 id（白名单顺序：按词条名） */
export async function neonAdminListEnabledTagIdsLinkedToRoleCategory(
  roleCategoryId: string,
): Promise<string[]> {
  const sql = getNeonSql()
  const rid = String(roleCategoryId).trim().toLowerCase()
  const rows = await sql`
    SELECT tg.id::text AS id
    FROM role_category_tags rct
    INNER JOIN tags tg ON tg.id = rct.tag_id
      AND COALESCE(tg.is_disabled, false) = false
    WHERE rct.role_category_id = ${rid}
    ORDER BY lower(trim(tg.name)) ASC
  `
  return (rows as { id: string }[]).map((r) => String(r.id).trim().toLowerCase())
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
          SELECT t.id, t.introduction FROM tools t
          WHERE t.name = ${nameKey}
            AND (
              t.category_id = ${categoryId}
              OR EXISTS (
                SELECT 1 FROM tool_categories tc
                WHERE tc.tool_id = t.id AND tc.category_id = ${categoryId}
              )
            )
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
  parent_id: string | null
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

/** 主分类或 junction 任一侧指向该菜单产品线即计数一次（同一工具只算 1）。 */
export async function neonCountDistinctToolsReferencingMenuCategory(
  categoryId: string,
): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM (
      SELECT DISTINCT id
      FROM tools
      WHERE category_id = ${categoryId}
      UNION
      SELECT DISTINCT tool_id AS id
      FROM tool_categories
      WHERE category_id = ${categoryId}
    ) sub
  `
  return Number((rows[0] as { n: number }).n ?? 0)
}

/** 删除空产品线分类：`hot`、仍有子分类、仍有工具关联时不允许。 */
export async function neonAdminDeleteMenuCategory(params: {
  categoryId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = params.categoryId.trim()
  if (!id.length) return { ok: false, error: '缺少分类' }

  const slug = await neonCategorySlugById(id)
  if (!slug) return { ok: false, error: '菜单分类不存在' }
  if (slug === 'hot') return { ok: false, error: '不能删除 slug 为 hot 的热门产品线' }

  const childN = await neonCountChildCategories(id)
  if (childN > 0) {
    return {
      ok: false,
      error: `仍有 ${childN} 个子分类，请先删除或移动子分类`,
    }
  }

  const toolN = await neonCountDistinctToolsReferencingMenuCategory(id)
  if (toolN > 0) {
    return {
      ok: false,
      error: `仍有 ${toolN} 个工具以主分类或挂载关联本条，请先在后台移除挂载或改掉主分类`,
    }
  }

  try {
    await neonDeleteCategoryById(id)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : '删除失败（可能存在数据库约束冲突）',
    }
  }
}

export async function neonDeleteCategoryById(id: string): Promise<void> {
  const sql = getNeonSql()
  await sql`DELETE FROM categories WHERE id = ${id}`
}

/** 左侧产品线 categories：禁用后前台分类页与导航隐去（工具 category_id 保留）。 */
export async function neonAdminSetCategoryDisabled(params: {
  categoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    const rows = await sql`
      UPDATE categories
      SET is_disabled = ${params.isDisabled}
      WHERE id = ${params.categoryId}
      RETURNING id
    `
    if (!rows[0]) return { ok: false, error: '菜单分类不存在' }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to disable category',
    }
  }
}

/** 新建产品线分类（`categories`）；slug 由名称生成并避让冲突。 */
export async function neonAdminInsertMenuCategory(params: {
  name: string
  parentId: string | null
  icon?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const nm = params.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!nm.length) return { ok: false, error: '名称不能为空' }

  const pidRaw = params.parentId?.trim() ?? ''
  const parentId = pidRaw.length > 0 ? pidRaw : null

  const sql = getNeonSql()
  if (parentId != null) {
    const p = await sql`SELECT id FROM categories WHERE id = ${parentId} LIMIT 1`
    if (!p[0]) return { ok: false, error: '父分类不存在' }
  }

  const maxRows =
    parentId == null
      ? await sql`
          SELECT COALESCE(MAX(sort_order), 0)::int AS m
          FROM categories
          WHERE parent_id IS NULL
        `
      : await sql`
          SELECT COALESCE(MAX(sort_order), 0)::int AS m
          FROM categories
          WHERE parent_id = ${parentId}
        `
  const nextOrder =
    Number((maxRows[0] as { m?: number } | undefined)?.m ?? 0) + 1
  const icon = params.icon?.trim() ? params.icon.trim() : null

  let baseSlug = slugifyTagCategoryName(nm)
  for (let attempt = 0; attempt < 24; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${attempt}-${Date.now().toString(36).slice(-5)}`
    try {
      const ins = await sql`
        INSERT INTO categories (name, slug, parent_id, sort_order, icon, is_disabled)
        VALUES (${nm}, ${slug}, ${parentId}, ${nextOrder}, ${icon}, false)
        RETURNING id
      `
      return { ok: true, id: String((ins[0] as { id: string }).id) }
    } catch {
      baseSlug = slugifyTagCategoryName(`${nm}-${attempt + 2}`)
      continue
    }
  }

  return { ok: false, error: '无法生成可用的 slug，请稍后重试' }
}

export async function neonListCategoryTagLinks(): Promise<
  { category_id: string; tag_id: string }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT category_id, tag_id FROM category_tags
  `
  return (rows as { category_id: unknown; tag_id: unknown }[]).map((r) => ({
    category_id: String(r.category_id),
    tag_id: String(r.tag_id),
  }))
}

/** 管理后台：各产品线 junction 下「已通过且未隐藏工具」数（与 /category 列表口径一致；不含 hot 特例）。 */
export async function neonListAdminToolCountsByCategory(): Promise<
  { category_id: string; n: number }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tc.category_id::text AS category_id,
           COUNT(DISTINCT tc.tool_id)::int AS n
    FROM tool_categories tc
    INNER JOIN categories cat ON cat.id = tc.category_id
      AND COALESCE(cat.is_disabled, false) = false
    INNER JOIN tools t ON t.id = tc.tool_id
    WHERE t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    GROUP BY tc.category_id
  `
  return (rows as { category_id: unknown; n: unknown }[]).map((r) => ({
    category_id: String(r.category_id),
    n: Number(r.n ?? 0),
  }))
}

/** 菜单分类管理页：全部 junction（含隐藏）；前台口径计数另见 neonListAdminToolCountsByCategory。 */
export async function neonListAdminToolCategoryMembershipRows(): Promise<
  {
    category_id: string
    tool_id: string
    name: string
    slug: string
    status: string
    is_disabled: boolean
    view_count: number | null
  }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tc.category_id::text AS category_id,
           t.id::text AS tool_id,
           t.name,
           t.slug,
           t.status,
           COALESCE(t.is_disabled, false) AS is_disabled,
           t.view_count
    FROM tool_categories tc
    INNER JOIN tools t ON t.id = tc.tool_id
    ORDER BY tc.category_id, t.view_count DESC NULLS LAST, t.name ASC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    category_id: String(r.category_id ?? ''),
    tool_id: String(r.tool_id ?? ''),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    status: String(r.status ?? ''),
    is_disabled: Boolean(r.is_disabled),
    view_count:
      r.view_count != null && r.view_count !== ''
        ? Number(r.view_count)
        : null,
  }))
}

/** 为本产品线挑选尚未挂载的工具（名称 / slug 模糊）。query 空则按热度返回候选。 */
export async function neonAdminSearchToolsNotInMenuCategory(params: {
  categoryId: string
  query: string
  limit?: number
}): Promise<{ id: string; name: string; slug: string }[]> {
  const sql = getNeonSql()
  const lim = Math.min(Math.max(params.limit ?? 40, 1), 80)
  const q = params.query.normalize('NFKC').trim()
  const rows =
    q.length === 0
      ? await sql`
          SELECT t.id::text AS id, t.name, t.slug
          FROM tools t
          WHERE NOT EXISTS (
            SELECT 1 FROM tool_categories tc
            WHERE tc.tool_id = t.id AND tc.category_id = ${params.categoryId}
          )
          ORDER BY t.view_count DESC NULLS LAST, t.updated_at DESC
          LIMIT ${lim}
        `
      : await sql`
          SELECT t.id::text AS id, t.name, t.slug
          FROM tools t
          WHERE NOT EXISTS (
            SELECT 1 FROM tool_categories tc
            WHERE tc.tool_id = t.id AND tc.category_id = ${params.categoryId}
          )
            AND (
              t.name ILIKE ${'%' + q + '%'}
              OR t.slug ILIKE ${'%' + q + '%'}
            )
          ORDER BY t.view_count DESC NULLS LAST, t.updated_at DESC
          LIMIT ${lim}
        `
  return (rows as { id: string; name: string; slug: string }[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
  }))
}

/** 热门产品线挂载：候选为尚未勾选 is_featured 的工具（与 junction 无关）。 */
export async function neonAdminSearchToolsForHotPicker(params: {
  query: string
  limit?: number
}): Promise<{ id: string; name: string; slug: string }[]> {
  const sql = getNeonSql()
  const lim = Math.min(Math.max(params.limit ?? 40, 1), 80)
  const q = params.query.normalize('NFKC').trim()
  const rows =
    q.length === 0
      ? await sql`
          SELECT t.id::text AS id, t.name, t.slug
          FROM tools t
          WHERE COALESCE(t.is_featured, false) = false
          ORDER BY t.view_count DESC NULLS LAST, t.updated_at DESC
          LIMIT ${lim}
        `
      : await sql`
          SELECT t.id::text AS id, t.name, t.slug
          FROM tools t
          WHERE COALESCE(t.is_featured, false) = false
            AND (
              t.name ILIKE ${'%' + q + '%'}
              OR t.slug ILIKE ${'%' + q + '%'}
            )
          ORDER BY t.view_count DESC NULLS LAST, t.updated_at DESC
          LIMIT ${lim}
        `
  return (rows as { id: string; name: string; slug: string }[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
  }))
}

/** 管理后台「工具与标签」：标签搜索候选项（仅必要列 + LIMIT）。 */
export type AdminTagPickerRow = {
  id: string
  name: string
  tag_category_id: string | null
  is_disabled: boolean
}

/** 「场景」筛选项：`all` 不限；`uncategorized` 仅 tag_category_id 为空；`scene` 按场景分类 id。 */
export type AdminTagSceneFilter =
  | { kind: 'all' }
  | { kind: 'uncategorized' }
  | { kind: 'scene'; tagCategoryId: string }

function mapAdminTagPickerRow(r: Record<string, unknown>): AdminTagPickerRow {
  const tc = r.tag_category_id
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    tag_category_id:
      tc != null && String(tc).trim() !== '' ? String(tc) : null,
    is_disabled: Boolean(r.is_disabled),
  }
}

/**
 * 标签模糊搜索（ILIKE），严格 LIMIT；空关键词时按 tool_tags 引用次数倒序再按名排序。
 * 上万级词表可接受：只扫 tags + 聚合子查询，且结果条数封顶。
 */
export async function neonAdminSearchTagsForPicker(params: {
  query: string
  scene: AdminTagSceneFilter
  limit?: number
}): Promise<AdminTagPickerRow[]> {
  const sql = getNeonSql()
  const lim = Math.min(Math.max(params.limit ?? 40, 1), 80)
  const q = params.query.normalize('NFKC').trim()
  const pattern = `%${q}%`
  const scene = params.scene

  const rows =
    scene.kind === 'all'
      ? q.length === 0
        ? await sql`
            SELECT
              t.id::text AS id,
              t.name,
              t.tag_category_id::text AS tag_category_id,
              COALESCE(t.is_disabled, false) AS is_disabled
            FROM tags t
            LEFT JOIN (
              SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
            ) u ON u.tag_id = t.id
            ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
            LIMIT ${lim}
          `
        : await sql`
            SELECT
              t.id::text AS id,
              t.name,
              t.tag_category_id::text AS tag_category_id,
              COALESCE(t.is_disabled, false) AS is_disabled
            FROM tags t
            LEFT JOIN (
              SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
            ) u ON u.tag_id = t.id
            WHERE t.name ILIKE ${pattern}
            ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
            LIMIT ${lim}
          `
      : scene.kind === 'uncategorized'
        ? q.length === 0
          ? await sql`
              SELECT
                t.id::text AS id,
                t.name,
                t.tag_category_id::text AS tag_category_id,
                COALESCE(t.is_disabled, false) AS is_disabled
              FROM tags t
              LEFT JOIN (
                SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
              ) u ON u.tag_id = t.id
              WHERE t.tag_category_id IS NULL
              ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
              LIMIT ${lim}
            `
          : await sql`
              SELECT
                t.id::text AS id,
                t.name,
                t.tag_category_id::text AS tag_category_id,
                COALESCE(t.is_disabled, false) AS is_disabled
              FROM tags t
              LEFT JOIN (
                SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
              ) u ON u.tag_id = t.id
              WHERE t.tag_category_id IS NULL AND t.name ILIKE ${pattern}
              ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
              LIMIT ${lim}
            `
        : q.length === 0
          ? await sql`
              SELECT
                t.id::text AS id,
                t.name,
                t.tag_category_id::text AS tag_category_id,
                COALESCE(t.is_disabled, false) AS is_disabled
              FROM tags t
              LEFT JOIN (
                SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
              ) u ON u.tag_id = t.id
              WHERE t.tag_category_id = ${scene.tagCategoryId}
              ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
              LIMIT ${lim}
            `
          : await sql`
              SELECT
                t.id::text AS id,
                t.name,
                t.tag_category_id::text AS tag_category_id,
                COALESCE(t.is_disabled, false) AS is_disabled
              FROM tags t
              LEFT JOIN (
                SELECT tag_id, COUNT(*)::int AS usage_n FROM tool_tags GROUP BY tag_id
              ) u ON u.tag_id = t.id
              WHERE t.tag_category_id = ${scene.tagCategoryId}
                AND t.name ILIKE ${pattern}
              ORDER BY COALESCE(u.usage_n, 0) DESC, t.name ASC
              LIMIT ${lim}
            `

  return (rows as Record<string, unknown>[]).map(mapAdminTagPickerRow)
}

/** 管理后台：按名称/slug 搜索工具（仅 `status = approved` 且未隐藏），用于打标签选人。返回分页信息与总数。 */
export async function neonAdminSearchToolsForTagging(params: {
  query: string
  limit?: number
  /** taxonomy「挂载 / 移除挂载」分页偏移；通用打标签不传或为 0 */
  offset?: number
  /**
   * 挂载工具选人：排除「已挂上本分类词条」的工具（NOT EXISTS 不计 tag 是否禁用，含失效词条）。
   * 场景：`tags.tag_category_id = 该场景`
   * 角色：`role_category_tags` 联结（词条禁用仍算已关联本品）
   */
  excludeListedInTaxonomy?:
    | { kind: 'scene'; tagCategoryId: string }
    | { kind: 'role'; roleCategoryId: string }
  /**
   * 移除挂载选人：仅保留「至少挂有一条本分类词条」的工具（与 exclude 互斥，优先 only）。
   */
  onlyListedInTaxonomy?:
    | { kind: 'scene'; tagCategoryId: string }
    | { kind: 'role'; roleCategoryId: string }
}): Promise<{
  tools: { id: string; name: string; slug: string; status: string }[]
  total: number
}> {
  const sql = getNeonSql()
  const taxonomyPick =
    params.onlyListedInTaxonomy != null ||
    params.excludeListedInTaxonomy != null
  const defaultLim = taxonomyPick ? 50 : 30
  const maxLim = 50
  const lim = Math.min(Math.max(params.limit ?? defaultLim, 1), maxLim)
  const off = taxonomyPick
    ? Math.max(0, Math.floor(Number(params.offset ?? 0)))
    : 0
  const q = params.query.normalize('NFKC').trim()
  const only = params.onlyListedInTaxonomy
  const ex = params.excludeListedInTaxonomy

  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      slug: String(r.slug ?? ''),
      status: String(r.status ?? ''),
    }))

  async function countedPair(
    countRows: Promise<unknown[]>,
    pageRows: Promise<unknown[]>,
  ): Promise<{
    tools: ReturnType<typeof mapRows>
    total: number
  }> {
    const [nRows, rows] = await Promise.all([countRows, pageRows])
    const total = Number((nRows[0] as { n?: number } | undefined)?.n ?? 0)
    return { tools: mapRows(rows as Record<string, unknown>[]), total }
  }

  if (only) {
    if (only.kind === 'scene') {
      const cid = String(only.tagCategoryId).trim().toLowerCase()
      if (q.length === 0) {
        return countedPair(
          sql`
            SELECT COUNT(*)::int AS n
            FROM tools t
            WHERE t.status = 'approved'
              AND COALESCE(t.is_disabled, false) = false
              AND EXISTS (
                SELECT 1
                FROM tool_tags tt
                INNER JOIN tags tg ON tg.id = tt.tag_id
                  AND tg.tag_category_id = ${cid}
                WHERE tt.tool_id = t.id
              )
          `,
          sql`
            SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
            FROM tools t
            WHERE t.status = 'approved'
              AND COALESCE(t.is_disabled, false) = false
              AND EXISTS (
                SELECT 1
                FROM tool_tags tt
                INNER JOIN tags tg ON tg.id = tt.tag_id
                  AND tg.tag_category_id = ${cid}
                WHERE tt.tool_id = t.id
              )
            ORDER BY t.updated_at DESC NULLS LAST
            LIMIT ${lim} OFFSET ${off}
          `,
        )
      }
      return countedPair(
        sql`
          SELECT COUNT(*)::int AS n
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
            AND EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
                AND tg.tag_category_id = ${cid}
              WHERE tt.tool_id = t.id
            )
        `,
        sql`
          SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
            AND EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
                AND tg.tag_category_id = ${cid}
              WHERE tt.tool_id = t.id
            )
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim} OFFSET ${off}
        `,
      )
    }

    const rid = String(only.roleCategoryId).trim().toLowerCase()
    if (q.length === 0) {
      return countedPair(
        sql`
          SELECT COUNT(*)::int AS n
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
              INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
                AND rct.role_category_id = ${rid}
              WHERE tt.tool_id = t.id
            )
        `,
        sql`
          SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
              INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
                AND rct.role_category_id = ${rid}
              WHERE tt.tool_id = t.id
            )
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim} OFFSET ${off}
        `,
      )
    }
    return countedPair(
      sql`
        SELECT COUNT(*)::int AS n
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
          AND EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
            INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
              AND rct.role_category_id = ${rid}
            WHERE tt.tool_id = t.id
          )
      `,
      sql`
        SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
          AND EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
            INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
              AND rct.role_category_id = ${rid}
            WHERE tt.tool_id = t.id
          )
        ORDER BY t.updated_at DESC NULLS LAST
        LIMIT ${lim} OFFSET ${off}
      `,
    )
  }

  if (!ex) {
    if (q.length === 0) {
      return countedPair(
        sql`
          SELECT COUNT(*)::int AS n
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
        `,
        sql`
          SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim} OFFSET ${off}
        `,
      )
    }
    return countedPair(
      sql`
        SELECT COUNT(*)::int AS n
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
      `,
      sql`
        SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
        ORDER BY t.updated_at DESC NULLS LAST
        LIMIT ${lim} OFFSET ${off}
      `,
    )
  }

  if (ex.kind === 'scene') {
    const cid = String(ex.tagCategoryId).trim().toLowerCase()
    if (q.length === 0) {
      return countedPair(
        sql`
          SELECT COUNT(*)::int AS n
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND NOT EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
                AND tg.tag_category_id = ${cid}
              WHERE tt.tool_id = t.id
            )
        `,
        sql`
          SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
          FROM tools t
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND NOT EXISTS (
              SELECT 1
              FROM tool_tags tt
              INNER JOIN tags tg ON tg.id = tt.tag_id
                AND tg.tag_category_id = ${cid}
              WHERE tt.tool_id = t.id
            )
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim} OFFSET ${off}
        `,
      )
    }
    return countedPair(
      sql`
        SELECT COUNT(*)::int AS n
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
          AND NOT EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
              AND tg.tag_category_id = ${cid}
            WHERE tt.tool_id = t.id
          )
      `,
      sql`
        SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
          AND NOT EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
              AND tg.tag_category_id = ${cid}
            WHERE tt.tool_id = t.id
          )
        ORDER BY t.updated_at DESC NULLS LAST
        LIMIT ${lim} OFFSET ${off}
      `,
    )
  }

  const rid = String(ex.roleCategoryId).trim().toLowerCase()
  if (q.length === 0) {
    return countedPair(
      sql`
        SELECT COUNT(*)::int AS n
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
            INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
            WHERE tt.tool_id = t.id
              AND rct.role_category_id = ${rid}
          )
      `,
      sql`
        SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
        FROM tools t
        WHERE t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM tool_tags tt
            INNER JOIN tags tg ON tg.id = tt.tag_id
            INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
            WHERE tt.tool_id = t.id
              AND rct.role_category_id = ${rid}
          )
        ORDER BY t.updated_at DESC NULLS LAST
        LIMIT ${lim} OFFSET ${off}
      `,
    )
  }
  return countedPair(
    sql`
      SELECT COUNT(*)::int AS n
      FROM tools t
      WHERE t.status = 'approved'
        AND COALESCE(t.is_disabled, false) = false
        AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
        AND NOT EXISTS (
          SELECT 1
          FROM tool_tags tt
          INNER JOIN tags tg ON tg.id = tt.tag_id
          INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
          WHERE tt.tool_id = t.id
            AND rct.role_category_id = ${rid}
        )
    `,
    sql`
      SELECT t.id::text AS id, t.name, t.slug, t.status::text AS status
      FROM tools t
      WHERE t.status = 'approved'
        AND COALESCE(t.is_disabled, false) = false
        AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
        AND NOT EXISTS (
          SELECT 1
          FROM tool_tags tt
          INNER JOIN tags tg ON tg.id = tt.tag_id
          INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
          WHERE tt.tool_id = t.id
            AND rct.role_category_id = ${rid}
        )
      ORDER BY t.updated_at DESC NULLS LAST
      LIMIT ${lim} OFFSET ${off}
    `,
  )
}

/** 个人中心「我的关注」搜索可加关注的工具（已通过且未隐藏；返回完整 `Tool` 供卡片/hover） */
export async function neonAccountSearchListedToolsForFollows(params: {
  query: string
  limit?: number
}): Promise<Tool[]> {
  const sql = getNeonSql()
  const lim = Math.min(Math.max(params.limit ?? 24, 1), 40)
  const q = params.query.normalize('NFKC').trim()
  const rows =
    q.length === 0
      ? await sql`
          SELECT t.*, row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
            AND COALESCE(c.is_disabled, false) = false
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim}
        `
      : await sql`
          SELECT t.*, row_to_json(c.*) AS category
          FROM tools t
          LEFT JOIN categories c ON c.id = t.category_id
            AND COALESCE(c.is_disabled, false) = false
          WHERE t.status = 'approved'
            AND COALESCE(t.is_disabled, false) = false
            AND (t.name ILIKE ${'%' + q + '%'} OR t.slug ILIKE ${'%' + q + '%'})
          ORDER BY t.updated_at DESC NULLS LAST
          LIMIT ${lim}
        `
  return (rows as Record<string, unknown>[]).map((row) => {
    const cat = parseCategoryJson(row.category)
    const { category: _drop, ...rest } = row
    return publicizeToolImages(mapToolRow(rest as Record<string, unknown>, cat))
  })
}

/** 管理后台工具标签编辑：含 `tags.tag_category_id`，便于保存时回传场景挂载提示 */
export async function neonAdminGetToolTagsForEditor(
  toolId: string,
): Promise<{ name: string; tag_category_id: string | null }[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      tg.name AS name,
      tg.tag_category_id::text AS tag_category_id
    FROM tool_tags tt
    INNER JOIN tags tg ON tg.id = tt.tag_id
    WHERE tt.tool_id = ${toolId}
    ORDER BY tt.sort_order ASC
  `
  return (rows as { name?: string; tag_category_id?: string | null }[]).map(
    (r) => ({
      name: String(r.name ?? ''),
      tag_category_id:
        r.tag_category_id != null && String(r.tag_category_id).trim() !== ''
          ? String(r.tag_category_id).trim().toLowerCase()
          : null,
    }),
  )
}

/** 角色分类已挂载的标签（与 taxonomy 一致），用于一键并入草稿。 */
export async function neonAdminListTagsForRoleCategoryPicklist(
  roleCategoryId: string,
): Promise<AdminTagPickerRow[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      tg.id::text AS id,
      tg.name,
      tg.tag_category_id::text AS tag_category_id,
      COALESCE(tg.is_disabled, false) AS is_disabled
    FROM role_category_tags rct
    INNER JOIN tags tg ON tg.id = rct.tag_id
    WHERE rct.role_category_id = ${roleCategoryId}
    ORDER BY rct.sort_order ASC, tg.name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapAdminTagPickerRow)
}

export async function neonGetAdminToolCategoryAggregateStats(): Promise<{
  membershipEdgesTotal: number
  membershipEdgesPublicListed: number
  distinctToolsTotal: number
  distinctToolsPublicListed: number
}> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM tool_categories) AS edges_total,
      (
        SELECT COUNT(*)::int FROM tool_categories tc
        INNER JOIN tools t ON t.id = tc.tool_id
          AND t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
        INNER JOIN categories c ON c.id = tc.category_id
          AND COALESCE(c.is_disabled, false) = false
      ) AS edges_public,
      (SELECT COUNT(DISTINCT tool_id)::int FROM tool_categories) AS tools_total,
      (
        SELECT COUNT(DISTINCT tc.tool_id)::int FROM tool_categories tc
        INNER JOIN tools t ON t.id = tc.tool_id
          AND t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
        INNER JOIN categories c ON c.id = tc.category_id
          AND COALESCE(c.is_disabled, false) = false
      ) AS tools_public
  `
  const r = rows[0] as
    | {
        edges_total: number
        edges_public: number
        tools_total: number
        tools_public: number
      }
    | undefined
  return {
    membershipEdgesTotal: Number(r?.edges_total ?? 0),
    membershipEdgesPublicListed: Number(r?.edges_public ?? 0),
    distinctToolsTotal: Number(r?.tools_total ?? 0),
    distinctToolsPublicListed: Number(r?.tools_public ?? 0),
  }
}

export async function neonAdminLinkToolToMenuCategory(params: {
  categoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  const c =
    await sql`SELECT id FROM categories WHERE id = ${params.categoryId} LIMIT 1`
  if (!c[0]) return { ok: false, error: '菜单分类不存在' }
  const t = await sql`SELECT id FROM tools WHERE id = ${params.toolId} LIMIT 1`
  if (!t[0]) return { ok: false, error: '工具不存在' }
  try {
    await sql`
      INSERT INTO tool_categories (tool_id, category_id, sort_order)
      VALUES (${params.toolId}, ${params.categoryId}, 0)
      ON CONFLICT (tool_id, category_id) DO NOTHING
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to link tool',
    }
  }
}

export async function neonAdminUnlinkToolFromMenuCategory(params: {
  categoryId: string
  toolId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    await sql`
      DELETE FROM tool_categories
      WHERE category_id = ${params.categoryId}
        AND tool_id = ${params.toolId}
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to unlink tool',
    }
  }
}

export async function neonAdminLinkTagToMenuCategory(params: {
  categoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  const c = await sql`SELECT id FROM categories WHERE id = ${params.categoryId} LIMIT 1`
  if (!c[0]) return { ok: false, error: '菜单分类不存在' }
  const t = await sql`SELECT id FROM tags WHERE id = ${params.tagId} LIMIT 1`
  if (!t[0]) return { ok: false, error: '标签不存在' }
  try {
    await sql`
      INSERT INTO category_tags (category_id, tag_id, sort_order)
      VALUES (${params.categoryId}, ${params.tagId}, 0)
      ON CONFLICT (category_id, tag_id) DO NOTHING
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to link tag',
    }
  }
}

export async function neonAdminUnlinkTagFromMenuCategory(params: {
  categoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    await sql`
      DELETE FROM category_tags
      WHERE category_id = ${params.categoryId}
        AND tag_id = ${params.tagId}
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to unlink tag',
    }
  }
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
  } else {
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
  await neonEnsureToolMenuCategoryLink(toolId, patch.category_id)
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
  await neonEnsureToolMenuCategoryLink(
    input.toolId,
    v.category_id as string | null,
  )
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
  const id = String((rows[0] as { id: string }).id)
  await neonEnsureToolMenuCategoryLink(id, v.category_id as string | null)
  return id
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
// 标签清理（/admin/tags）
// =====================================================================

export async function neonListTagCategoriesAll(): Promise<TagCategory[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM tag_categories
    ORDER BY sort_order ASC, name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapTagCategoryRow)
}

/**
 * 前台用：不包含已禁用的场景分类（首页、「按场景找 AI」卡片、聚合页等）。
 */
export async function neonListTagCategoriesEnabled(): Promise<TagCategory[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM tag_categories
    WHERE COALESCE(is_disabled, false) = false
    ORDER BY sort_order ASC, name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapTagCategoryRow)
}

export async function neonGetTagCategoryBySlug(
  slug: string,
  opts?: { includeDisabled?: boolean },
): Promise<TagCategory | null> {
  const sql = getNeonSql()
  const rows = opts?.includeDisabled
    ? await sql`
      SELECT id, name, slug, icon, sort_order, description, created_at,
             COALESCE(is_disabled, false) AS is_disabled
      FROM tag_categories WHERE slug = ${slug} LIMIT 1
    `
    : await sql`
      SELECT id, name, slug, icon, sort_order, description, created_at,
             COALESCE(is_disabled, false) AS is_disabled
      FROM tag_categories
      WHERE slug = ${slug}
        AND COALESCE(is_disabled, false) = false
      LIMIT 1
    `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapTagCategoryRow(r) : null
}

export async function neonGetTagCategoryById(
  tagCategoryId: string,
): Promise<TagCategory | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM tag_categories WHERE id = ${tagCategoryId} LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapTagCategoryRow(r) : null
}

/**
 * 管理后台：列出全部标签 + 工具数 + 场景分类。
 * 排序：is_curated DESC（curated 在前），同分类内按名称。
 */
export async function neonAdminListTagsAll(): Promise<AdminTagRow[]> {
  const sql = getNeonSql()
  const linked = await neonTagsHasTagCategoryLinkedAtColumn()
  const rows = linked
    ? await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.tag_category_linked_at,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
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
    : await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
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

/** 自动提取标签：全库 name + aliases，供规则打分字典（只读） */
export async function neonListTagsSuggestDictionary(): Promise<
  { name: string; aliases: string[] }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT name, COALESCE(aliases, '{}'::text[]) AS aliases
    FROM tags
    WHERE COALESCE(is_disabled, false) = false
    ORDER BY lower(trim(name))
  `
  return (rows as { name: unknown; aliases: unknown }[])
    .map((r) => {
      const name = String(r.name ?? '').trim()
      const aliases = Array.isArray(r.aliases)
        ? (r.aliases as string[]).map((x) => String(x).trim()).filter(Boolean)
        : []
      return { name, aliases }
    })
    .filter((r) => r.name.length > 0)
}

/**
 * 管理员新建标签（可控词表扩充）。
 * `tag_category_id` 为场景归属（tag_categories）；可为 null——词表仍参与匹配，再通过 role/menu 联结表挂角色或产品线。
 * **`is_curated = true` 时必须有场景归属**，与本应用后台约束一致。
 */
export async function neonAdminInsertTag(params: {
  name: string
  tagCategoryId: string | null
  isCurated: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const n = params.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!n) return { ok: false, error: '名称不能为空' }
  const catRaw = params.tagCategoryId?.trim() ?? ''
  const tagCatVal =
    catRaw === '' ? null : catRaw.trim().toLowerCase()
  if (params.isCurated && tagCatVal == null) {
    return {
      ok: false,
      error:
        'Curated 标签必须归属场景分类（tags.tag_category_id）；请先选择 tag_categories 或改为未 curated。',
    }
  }
  const sql = getNeonSql()
  const dup = await sql`
    SELECT id FROM tags WHERE lower(trim(name)) = lower(${n}) LIMIT 1
  `
  if (dup.length > 0) return { ok: false, error: '已存在同名标签' }
  try {
    const linked = await neonTagsHasTagCategoryLinkedAtColumn()
    const ins = linked
      ? await sql`
          INSERT INTO tags (name, tag_category_id, is_curated, aliases, tag_category_linked_at)
          VALUES (${n}, ${tagCatVal}, ${params.isCurated}, '{}'::text[],
            CASE WHEN ${tagCatVal} IS NOT NULL THEN now() ELSE NULL END)
          RETURNING id
        `
      : await sql`
          INSERT INTO tags (name, tag_category_id, is_curated, aliases)
          VALUES (${n}, ${tagCatVal}, ${params.isCurated}, '{}'::text[])
          RETURNING id
        `
    return { ok: true, id: String((ins[0] as { id: string }).id) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '写入失败' }
  }
}

/**
 * 管理员：新建场景分类（`tag_categories`）；slug 由名称生成并在冲突时重试。
 */
export async function neonAdminInsertTagCategory(params: {
  name: string
  icon?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const nm = params.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!nm.length) return { ok: false, error: '名称不能为空' }

  const sql = getNeonSql()
  const dupeName = await sql`
    SELECT id FROM tag_categories WHERE lower(trim(name)) = lower(${nm}) LIMIT 1
  `
  if (dupeName.length > 0) return { ok: false, error: '已存在同名场景分类' }

  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM tag_categories
  `
  const nextOrder = Number((maxRows[0] as { m?: number }).m ?? 0) + 1
  const icon = params.icon?.trim() ? params.icon.trim() : null
  let baseSlug = slugifyTagCategoryName(nm)

  for (let attempt = 0; attempt < 24; attempt++) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug}-${attempt}-${Date.now().toString(36).slice(-5)}`
    try {
      const ins = await sql`
        INSERT INTO tag_categories (name, slug, icon, sort_order)
        VALUES (${nm}, ${slug}, ${icon}, ${nextOrder})
        RETURNING id
      `
      return { ok: true, id: String((ins[0] as { id: string }).id) }
    } catch {
      baseSlug = slugifyTagCategoryName(`${nm}-${attempt + 2}`)
      continue
    }
  }

  return { ok: false, error: '无法生成可用的 slug，请稍后重试' }
}

export async function neonAdminSetTagCategoryDisabled(params: {
  tagCategoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    const rows = await sql`
      UPDATE tag_categories
      SET is_disabled = ${params.isDisabled}
      WHERE id = ${params.tagCategoryId}
      RETURNING id
    `
    if (!rows[0]) return { ok: false, error: '场景分类不存在' }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to disable tag category',
    }
  }
}

// =====================================================================
// 角色分类（`role_categories` / `role_category_tags`）
// =====================================================================

export async function neonListRoleCategoriesAll(): Promise<RoleCategory[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, tagline, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM role_categories
    ORDER BY sort_order ASC, name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapRoleCategoryRow)
}

export async function neonListRoleCategoriesEnabled(): Promise<RoleCategory[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, tagline, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM role_categories
    WHERE COALESCE(is_disabled, false) = false
    ORDER BY sort_order ASC, name ASC
  `
  return (rows as Record<string, unknown>[]).map(mapRoleCategoryRow)
}

export async function neonGetRoleCategoryBySlug(
  slug: string,
  opts?: { includeDisabled?: boolean },
): Promise<RoleCategory | null> {
  const sql = getNeonSql()
  const rows = opts?.includeDisabled
    ? await sql`
      SELECT id, name, slug, icon, sort_order, tagline, description, created_at,
             COALESCE(is_disabled, false) AS is_disabled
      FROM role_categories WHERE slug = ${slug} LIMIT 1
    `
    : await sql`
      SELECT id, name, slug, icon, sort_order, tagline, description, created_at,
             COALESCE(is_disabled, false) AS is_disabled
      FROM role_categories
      WHERE slug = ${slug} AND COALESCE(is_disabled, false) = false
      LIMIT 1
    `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapRoleCategoryRow(r) : null
}

export async function neonGetRoleCategoryById(
  roleCategoryId: string,
): Promise<RoleCategory | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, slug, icon, sort_order, tagline, description, created_at,
           COALESCE(is_disabled, false) AS is_disabled
    FROM role_categories WHERE id = ${roleCategoryId} LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapRoleCategoryRow(r) : null
}

export async function neonCountRoleCategoriesEnabled(): Promise<number> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM role_categories
    WHERE COALESCE(is_disabled, false) = false
  `
  return Number((rows[0] as { n?: number })?.n ?? 0)
}

export async function neonListRoleCategoryEnabledSlugs(): Promise<string[]> {
  const cats = await neonListRoleCategoriesEnabled()
  return cats.map((c) => c.slug)
}

export async function neonListTagsForRolePage(
  roleCategoryId: string,
): Promise<{ id: string; name: string; tag_category_id: string | null }[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.id, t.name, t.tag_category_id
    FROM role_category_tags rct
    JOIN tags t ON t.id = rct.tag_id
    WHERE rct.role_category_id = ${roleCategoryId}
      AND COALESCE(t.is_disabled, false) = false
    ORDER BY rct.sort_order ASC,
             lower(trim(t.name)),
             t.id::text
  `
  return (rows as { id: unknown; name: unknown; tag_category_id: unknown }[])
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      tag_category_id:
        r.tag_category_id == null || String(r.tag_category_id).trim() === ''
          ? null
          : String(r.tag_category_id),
    }))
}

export async function neonListRoleCategoryTagLinks(): Promise<
  { role_category_id: string; tag_id: string }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT role_category_id, tag_id FROM role_category_tags
  `
  return (rows as { role_category_id: unknown; tag_id: unknown }[]).map((r) => ({
    role_category_id: String(r.role_category_id),
    tag_id: String(r.tag_id),
  }))
}

export async function neonAdminInsertRoleCategory(params: {
  name: string
  icon?: string | null
  tagline?: string | null
  description?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const nm = params.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!nm.length) return { ok: false, error: '名称不能为空' }
  const taglineRaw = params.tagline?.normalize('NFKC').trim() ?? ''
  const descriptionRaw =
    params.description?.normalize('NFKC').trim().replace(/\s+/g, ' ') ?? ''
  const icon = params.icon?.trim() ? params.icon.trim() : null

  const sql = getNeonSql()
  const dupeName = await sql`
    SELECT id FROM role_categories WHERE lower(trim(name)) = lower(${nm}) LIMIT 1
  `
  if (dupeName.length > 0) return { ok: false, error: '已存在同名角色分类' }

  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM role_categories
  `
  const nextOrder = Number((maxRows[0] as { m?: number }).m ?? 0) + 1
  let baseSlug = slugifyTagCategoryName(nm)

  for (let attempt = 0; attempt < 24; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${attempt}-${Date.now().toString(36).slice(-5)}`
    try {
      const ins = await sql`
        INSERT INTO role_categories (
          name, slug, icon, sort_order,
          tagline, description, is_disabled
        )
        VALUES (
          ${nm}, ${slug}, ${icon}, ${nextOrder},
          ${taglineRaw}, ${descriptionRaw}, false
        )
        RETURNING id
      `
      return { ok: true, id: String((ins[0] as { id: string }).id) }
    } catch {
      baseSlug = slugifyTagCategoryName(`${nm}-${attempt + 2}`)
      continue
    }
  }

  return { ok: false, error: '无法生成可用的 slug，请稍后重试' }
}

export async function neonAdminSetRoleCategoryDisabled(params: {
  roleCategoryId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    const rows = await sql`
      UPDATE role_categories
      SET is_disabled = ${params.isDisabled}
      WHERE id = ${params.roleCategoryId}
      RETURNING id
    `
    if (!rows[0]) return { ok: false, error: '角色分类不存在' }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to disable role category',
    }
  }
}

export async function neonAdminLinkTagToRoleCategory(params: {
  roleCategoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  const roleRows = await sql`
    SELECT id FROM role_categories WHERE id = ${params.roleCategoryId} LIMIT 1
  `
  if (!roleRows[0]) return { ok: false, error: '角色分类不存在' }
  const tagRows = await sql`
    SELECT id FROM tags WHERE id = ${params.tagId} LIMIT 1
  `
  if (!tagRows[0]) return { ok: false, error: '标签不存在' }

  try {
    const maxRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS m
      FROM role_category_tags
      WHERE role_category_id = ${params.roleCategoryId}
    `
    const nextOrd = Number((maxRows[0] as { m?: number })?.m ?? -1) + 1
    await sql`
      INSERT INTO role_category_tags (role_category_id, tag_id, sort_order)
      VALUES (${params.roleCategoryId}, ${params.tagId}, ${nextOrd})
      ON CONFLICT (role_category_id, tag_id) DO NOTHING
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to link tag to role',
    }
  }
}

export async function neonAdminUnlinkTagFromRoleCategory(params: {
  roleCategoryId: string
  tagId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    await sql`
      DELETE FROM role_category_tags
      WHERE role_category_id = ${params.roleCategoryId}
        AND tag_id = ${params.tagId}
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to unlink tag',
    }
  }
}

/** 单条 Admin 标签行（与 `neonAdminListTagsAll` 同形状），用于写入后立即读回、避免 RSC refresh 滞后导致后台列表不刷新 */
export async function neonAdminGetAdminTagRowById(
  tagId: string,
): Promise<AdminTagRow | null> {
  const sql = getNeonSql()
  const tid = String(tagId).trim().toLowerCase()
  const linked = await neonTagsHasTagCategoryLinkedAtColumn()
  const rows = linked
    ? await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.tag_category_linked_at,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
               tc.name AS category_name,
               tc.slug AS category_slug,
               COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
                 AS tool_count
        FROM tags t
        LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
        WHERE t.id = ${tid}
        LIMIT 1
      `
    : await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
               tc.name AS category_name,
               tc.slug AS category_slug,
               COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
                 AS tool_count
        FROM tags t
        LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
        WHERE t.id = ${tid}
        LIMIT 1
      `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapAdminTagRow(r) : null
}

export async function neonAdminAssignTagToCategory(params: {
  tagId: string
  tagCategoryId: string | null
}): Promise<{ ok: true; tag: AdminTagRow } | { ok: false; error: string }> {
  const sql = getNeonSql()
  const tagId = String(params.tagId).trim().toLowerCase()
  const tagRows = await sql`
    SELECT id, is_curated FROM tags WHERE id = ${tagId} LIMIT 1
  `
  if (!tagRows[0]) return { ok: false, error: '标签不存在' }

  const cidRaw = params.tagCategoryId
  const cid =
    cidRaw == null || String(cidRaw).trim() === ''
      ? null
      : String(cidRaw).trim().toLowerCase()

  if (cid != null) {
    const catRows = await sql`
      SELECT id FROM tag_categories WHERE id = ${cid} LIMIT 1
    `
    if (!catRows[0]) return { ok: false, error: '场景分类不存在' }
  }

  const curatedFlag = Boolean((tagRows[0] as { is_curated?: boolean }).is_curated)
  if (cid == null && curatedFlag) {
    return {
      ok: false,
      error:
        'Curated 标签不能移出场景分类。请先在「标签清理」取消 Curated，再移出。',
    }
  }

  try {
    const linked = await neonTagsHasTagCategoryLinkedAtColumn()
    const updated = linked
      ? await sql`
          UPDATE tags
          SET tag_category_id = ${cid},
              tag_category_linked_at = now()
          WHERE id = ${tagId}
          RETURNING id
        `
      : await sql`
          UPDATE tags
          SET tag_category_id = ${cid}
          WHERE id = ${tagId}
          RETURNING id
        `
    if (!updated.length) {
      return { ok: false, error: '更新失败：未写入任何行' }
    }
    const tag = await neonAdminGetAdminTagRowById(tagId)
    if (!tag) return { ok: false, error: '更新后读取标签失败' }
    return { ok: true, tag }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to assign tag category',
    }
  }
}

/**
 * 待清理列表：is_curated = false，按工具数降序、再按名称。
 */
export async function neonAdminListUncuratedTags(): Promise<AdminTagRow[]> {
  const sql = getNeonSql()
  const linked = await neonTagsHasTagCategoryLinkedAtColumn()
  const rows = linked
    ? await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.tag_category_linked_at,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
               tc.name AS category_name,
               tc.slug AS category_slug,
               COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
                 AS tool_count
        FROM tags t
        LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
        WHERE t.is_curated = false
        ORDER BY tool_count DESC, t.name ASC
      `
    : await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
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
  const linked = await neonTagsHasTagCategoryLinkedAtColumn()
  const rows = linked
    ? await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.tag_category_linked_at,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
               tc.name AS category_name,
               tc.slug AS category_slug,
               COALESCE((SELECT COUNT(*) FROM tool_tags tt WHERE tt.tag_id = t.id), 0)::int
                 AS tool_count
        FROM tags t
        LEFT JOIN tag_categories tc ON tc.id = t.tag_category_id
        WHERE t.id = ${id}
        LIMIT 1
      `
    : await sql`
        SELECT t.id,
               t.name,
               t.tag_category_id,
               t.is_curated,
               t.aliases,
               t.created_at,
               COALESCE(t.is_disabled, false) AS is_disabled,
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

  try {
    const movedTools = await neonSqlBegin(async (sql) => {
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
      return updated.length
    })
    return { ok: true, movedTools }
  } catch (e) {
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
  const linked = await neonTagsHasTagCategoryLinkedAtColumn()
  if (linked) {
    await sql`
      UPDATE tags
      SET is_curated = ${input.isCurated},
          tag_category_id = ${input.tagCategoryId},
          tag_category_linked_at = now()
      WHERE id = ${input.tagId}
    `
  } else {
    await sql`
      UPDATE tags
      SET is_curated = ${input.isCurated},
          tag_category_id = ${input.tagCategoryId}
      WHERE id = ${input.tagId}
    `
  }
}

export async function neonAdminSetTagDisabled(params: {
  tagId: string
  isDisabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const sql = getNeonSql()
  try {
    const rows = await sql`
      UPDATE tags
      SET is_disabled = ${params.isDisabled}
      WHERE id = ${params.tagId}
      RETURNING id
    `
    if (!rows[0]) return { ok: false, error: '标签不存在' }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unable to disable tag',
    }
  }
}

/** 公开：按 slug 风格匹配（slug = encodeURIComponent(tag.name)）查标签；已禁用则视为不存在 */
export async function neonGetTagByName(name: string): Promise<{
  id: string
  name: string
  tag_category_id: string | null
} | null> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id, name, tag_category_id FROM tags
    WHERE lower(trim(name)) = lower(${name})
      AND COALESCE(is_disabled, false) = false
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
      AND COALESCE(c.is_disabled, false) = false
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
      AND COALESCE(tg.is_disabled, false) = false
    JOIN tools t ON t.id = tt.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
      AND COALESCE(c.is_disabled, false) = false
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

/**
 * 首页「按场景」卡片、场景聚合页列表、`neonListToolsByTagCategoryId` 列表长度，
 * 共用同一口径：`COUNT(DISTINCT tools.id)`，条件为工具已通过且未隐藏、关联标签未禁用、且标签挂载在该场景 id。
 */
export async function neonCountPublicListedToolsByTagCategoriesBulk(): Promise<
  Map<string, number>
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tg.tag_category_id::text AS cat_id,
           COUNT(DISTINCT t.id)::int AS n
    FROM tool_tags tt
    INNER JOIN tags tg ON tg.id = tt.tag_id
      AND COALESCE(tg.is_disabled, false) = false
    INNER JOIN tools t ON t.id = tt.tool_id
      AND t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    WHERE tg.tag_category_id IS NOT NULL
    GROUP BY tg.tag_category_id
  `
  const m = new Map<string, number>()
  for (const r of rows as { cat_id: string; n: number }[]) {
    const id = String(r.cat_id ?? '').trim().toLowerCase()
    if (!id) continue
    m.set(id, Number(r.n ?? 0))
  }
  return m
}

/**
 * 各角色分类下「收录工具」去重数（与 `neonListToolsByRoleCategoryId` 同源）；
 * 用于后台 Tab 加粗数字与首页「按角色」条带口径一致。
 */
export async function neonCountPublicListedToolsByRoleCategoriesBulk(): Promise<
  Map<string, number>
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT rct.role_category_id::text AS role_id,
           COUNT(DISTINCT t.id)::int AS n
    FROM tool_tags tt
    INNER JOIN tags tg ON tg.id = tt.tag_id
      AND COALESCE(tg.is_disabled, false) = false
    INNER JOIN role_category_tags rct ON rct.tag_id = tg.id
    INNER JOIN tools t ON t.id = tt.tool_id
      AND t.status = 'approved'
      AND COALESCE(t.is_disabled, false) = false
    GROUP BY rct.role_category_id
  `
  const m = new Map<string, number>()
  for (const r of rows as { role_id: string; n: number }[]) {
    const id = String(r.role_id ?? '').trim().toLowerCase()
    if (!id) continue
    m.set(id, Number(r.n ?? 0))
  }
  return m
}

/** 工具详情「所属场景」：当前挂载的启用标签所归属且未禁用的场景分类（去重） */
export async function neonListPublicSceneSummariesForTool(toolId: string): Promise<
  { id: string; name: string; slug: string }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id::text, name, slug
    FROM (
      SELECT DISTINCT ON (tc.id)
        tc.id,
        tc.name,
        tc.slug,
        tc.sort_order
      FROM tool_tags tt
      INNER JOIN tags tg ON tg.id = tt.tag_id
        AND COALESCE(tg.is_disabled, false) = false
        AND tg.tag_category_id IS NOT NULL
      INNER JOIN tag_categories tc ON tc.id = tg.tag_category_id
        AND COALESCE(tc.is_disabled, false) = false
      WHERE tt.tool_id = ${toolId}
      ORDER BY tc.id, tc.sort_order ASC
    ) sub
    ORDER BY sub.sort_order ASC, sub.name ASC
  `
  return (rows as { id: string; name: string; slug: string }[]).map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
  }))
}

export async function neonListToolsByRoleCategoryId(
  roleCategoryId: string,
): Promise<Tool[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT DISTINCT ON (t.id) t.*, row_to_json(c) AS category
    FROM tool_tags tt
    JOIN tags tg ON tg.id = tt.tag_id
      AND COALESCE(tg.is_disabled, false) = false
    JOIN role_category_tags rct ON rct.tag_id = tg.id
      AND rct.role_category_id = ${roleCategoryId}
    JOIN tools t ON t.id = tt.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
      AND COALESCE(c.is_disabled, false) = false
    WHERE t.status = 'approved' AND COALESCE(t.is_disabled, false) = false
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

/** 场景分类 → 旗下标签（按工具数降序），用于 /tag-category/[slug] 与首页卡片 chip */
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
      AND COALESCE(t.is_disabled, false) = false
    ORDER BY tool_count DESC, t.name ASC
    LIMIT ${limit}
  `
  return rows as { id: string; name: string; tool_count: number }[]
}

// =====================================================================
// 个人中心「我的关注」：场景 / 角色分类订阅
// =====================================================================

function normalizeFollowUuidArray(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const s = String(raw ?? '').trim().toLowerCase()
    if (!TAG_CATEGORY_HINT_UUID_RE.test(s)) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** 用户订阅的场景（JOIN 当前分类行；禁用仍可读出便于「失效」展示） */
export async function neonListUserFollowTagCategoriesJoined(
  userId: string,
): Promise<UserFollowCategoryJoined[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tc.id::text AS id,
           tc.name,
           tc.slug,
           COALESCE(tc.is_disabled, false) AS is_disabled,
           f.created_at AS created_at
    FROM user_follow_tag_categories f
    INNER JOIN tag_categories tc ON tc.id = f.tag_category_id
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at ASC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    is_disabled: r.is_disabled === true,
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
  }))
}

/** 用户订阅的角色分类（同上） */
export async function neonListUserFollowRoleCategoriesJoined(
  userId: string,
): Promise<UserFollowCategoryJoined[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT rc.id::text AS id,
           rc.name,
           rc.slug,
           COALESCE(rc.is_disabled, false) AS is_disabled,
           f.created_at AS created_at
    FROM user_follow_role_categories f
    INNER JOIN role_categories rc ON rc.id = f.role_category_id
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at ASC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    is_disabled: r.is_disabled === true,
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
  }))
}

export async function neonReplaceUserFollowTagCategories(
  userId: string,
  ids: string[],
): Promise<void> {
  const sql = getNeonSql()
  const norm = normalizeFollowUuidArray(ids)
  await sql`DELETE FROM user_follow_tag_categories WHERE user_id = ${userId}`
  if (norm.length === 0) return
  await sql`
    INSERT INTO user_follow_tag_categories (user_id, tag_category_id)
    SELECT ${userId}, u FROM unnest(${norm}::uuid[]) AS u
  `
}

export async function neonReplaceUserFollowRoleCategories(
  userId: string,
  ids: string[],
): Promise<void> {
  const sql = getNeonSql()
  const norm = normalizeFollowUuidArray(ids)
  await sql`DELETE FROM user_follow_role_categories WHERE user_id = ${userId}`
  if (norm.length === 0) return
  await sql`
    INSERT INTO user_follow_role_categories (user_id, role_category_id)
    SELECT ${userId}, u FROM unnest(${norm}::uuid[]) AS u
    `
}

/** 用户关注的工具列表（含下架快照，`listing_ok` 区分展示区域） */
export async function neonListUserFollowToolsForAccount(
  userId: string,
): Promise<UserFollowToolEntry[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT uft.tool_id::text AS tool_id,
           uft.sort_order::int AS sort_order,
           uft.created_at,
           row_to_json(t.*) AS tool_row,
           row_to_json(c.*) AS cat_row
    FROM user_follow_tools uft
    JOIN tools t ON t.id = uft.tool_id
    LEFT JOIN categories c ON c.id = t.category_id
      AND COALESCE(c.is_disabled, false) = false
    WHERE uft.user_id = ${userId}
    ORDER BY uft.sort_order ASC, uft.created_at ASC
  `
  const out: UserFollowToolEntry[] = []
  for (const r of rows as Record<string, unknown>[]) {
    const toolRaw = r.tool_row as Record<string, unknown> | null
    const catRaw = r.cat_row as Record<string, unknown> | null
    if (!toolRaw?.id) continue
    const cat = catRaw?.id ? parseCategoryJson(catRaw) : null
    const tool = publicizeToolImages(mapToolRow(toolRaw, cat ?? undefined))
    const listing_ok =
      tool.status === 'approved' && !(tool.is_disabled === true)
    const createdAt =
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? '')
    out.push({
      tool_id: String(r.tool_id ?? ''),
      sort_order: Number(r.sort_order ?? 0),
      created_at: createdAt,
      tool,
      listing_ok,
    })
  }
  return out
}

export async function neonReplaceUserFollowTools(
  userId: string,
  toolIdsOrdered: string[],
): Promise<{ error?: string }> {
  const norm = normalizeFollowUuidArray(toolIdsOrdered)
  if (norm.length > ACCOUNT_FOLLOW_TOOLS_MAX) {
    return { error: `最多关注 ${ACCOUNT_FOLLOW_TOOLS_MAX} 个工具` }
  }
  const sql = getNeonSql()
  if (norm.length > 0) {
    const chk = await sql`
      SELECT id::text FROM tools WHERE id = ANY(${norm}::uuid[])
    `
    if (chk.length !== norm.length) {
      return { error: '包含不存在或已删除的工具' }
    }
  }
  await sql`DELETE FROM user_follow_tools WHERE user_id = ${userId}`
  if (norm.length === 0) return {}
  const orders = norm.map((_, i) => i)
  await sql`
    INSERT INTO user_follow_tools (user_id, tool_id, sort_order)
    SELECT ${userId}, tid, ord
    FROM unnest(${norm}::uuid[], ${orders}::int[]) AS x(tid, ord)
  `
  return {}
}

async function loadRoleCategoryIdsByTagIds(
  tagIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (tagIds.length === 0) return out
  const sql = getNeonSql()
  const rows = await sql`
    SELECT tag_id::text AS tag_id, role_category_id::text AS role_category_id
    FROM role_category_tags
    WHERE tag_id = ANY(${tagIds}::uuid[])
  `
  for (const r of rows as { tag_id: string; role_category_id: string }[]) {
    const tid = String(r.tag_id ?? '')
    const rid = String(r.role_category_id ?? '')
    if (!tid || !rid) continue
    const arr = out.get(tid) ?? []
    arr.push(rid)
    out.set(tid, arr)
  }
  return out
}

/**
 * 门户分组：工具 ↔ 启用标签 ↔ 场景 tag_category_id / 角色 role_category_tags。
 */
export async function neonPortalTaxonomyMapsForTools(toolIds: string[]): Promise<{
  tagsByTool: Map<string, NonNullable<Tool['tool_tags']>>
  rolesByTagId: Map<string, string[]>
}> {
  const rawTags = await loadToolTagsForTools(toolIds)
  const tagsByTool = new Map<string, NonNullable<Tool['tool_tags']>>()
  for (const [tid, links] of rawTags) {
    tagsByTool.set(tid, links ?? [])
  }
  const tagIdSet = new Set<string>()
  for (const links of tagsByTool.values()) {
    for (const row of links) {
      tagIdSet.add(row.tag.id)
    }
  }
  const rolesByTagId = await loadRoleCategoryIdsByTagIds([...tagIdSet])
  return { tagsByTool, rolesByTagId }
}

/** 个人门户内打开工具：已通过且未隐藏，或当前用户为提交者 */
export async function neonGetToolForAccountPortal(
  slug: string,
  userId: string,
): Promise<Tool | null> {
  const norm = decodeURIComponent(slug ?? '').trim()
  if (!norm) return null
  const sql = getNeonSql()
  const rows = await sql`
    SELECT t.*, row_to_json(c.*) AS category
    FROM tools t
    LEFT JOIN categories c ON c.id = t.category_id
      AND COALESCE(c.is_disabled, false) = false
    WHERE trim(t.slug) = trim(${norm})
      AND (
        (
          t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
        )
        OR t.user_id = ${userId}
      )
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  const tool = publicizeToolImages(rowToTool(row))
  const tagMap = await loadToolTagsForTools([tool.id])
  const tags = tagMap.get(tool.id)
  return tags ? { ...tool, tool_tags: tags } : tool
}

export async function neonListToolCommentsMineForUser(
  userId: string,
  opts?: { limit?: number; listedToolsOnly?: boolean },
): Promise<ToolCommentMineRow[]> {
  const lim = Math.min(Math.max(opts?.limit ?? 120, 1), 300)
  const listedOnly = opts?.listedToolsOnly === true
  const sql = getNeonSql()
  const rows = listedOnly
    ? await sql`
        SELECT
          tc.*,
          t.name AS tool_name,
          t.slug AS tool_slug
        FROM tool_comments tc
        JOIN tools t ON t.id = tc.tool_id
        WHERE tc.user_id = ${userId}
          AND COALESCE(tc.is_hidden, false) = false
          AND t.status = 'approved'
          AND COALESCE(t.is_disabled, false) = false
        ORDER BY tc.created_at DESC
        LIMIT ${lim}
      `
    : await sql`
        SELECT
          tc.*,
          t.name AS tool_name,
          t.slug AS tool_slug
        FROM tool_comments tc
        JOIN tools t ON t.id = tc.tool_id
        WHERE tc.user_id = ${userId}
          AND COALESCE(tc.is_hidden, false) = false
        ORDER BY tc.created_at DESC
        LIMIT ${lim}
      `
  return (rows as Record<string, unknown>[]).map((r) => ({
    ...mapCommentRow(r),
    tool_name: String(r.tool_name ?? ''),
    tool_slug: String(r.tool_slug ?? ''),
  }))
}

export async function neonUpdateProfilePortalPreferences(
  userId: string,
  patch: {
    portal_home_enabled?: boolean
    portal_section_config?: PortalSectionConfigEntry[] | null
    portal_theme?: string | null
  },
): Promise<void> {
  const sql = getNeonSql()
  if (patch.portal_home_enabled !== undefined) {
    await sql`
      UPDATE profiles
      SET portal_home_enabled = ${patch.portal_home_enabled}
      WHERE id = ${userId}
    `
  }
  if (patch.portal_section_config !== undefined) {
    const json =
      patch.portal_section_config == null
        ? null
        : JSON.stringify(patch.portal_section_config)
    await sql`
      UPDATE profiles
      SET portal_section_config = ${json}::jsonb
      WHERE id = ${userId}
    `
  }
  if (patch.portal_theme !== undefined) {
    const th =
      patch.portal_theme == null || String(patch.portal_theme).trim() === ''
        ? 'default'
        : String(patch.portal_theme).trim()
    await sql`
      UPDATE profiles SET portal_theme = ${th} WHERE id = ${userId}
    `
  }
}

export async function neonSubmitShowcaseApplication(
  userId: string,
  input: { title: string; summary: string },
): Promise<{ error?: string }> {
  const title = input.title.trim()
  const summary = input.summary.trim()
  if (title.length < 2 || title.length > 120) {
    return { error: '标题长度为 2～120 字' }
  }
  if (summary.length < 10 || summary.length > 500) {
    return { error: '简介长度为 10～500 字' }
  }
  const sql = getNeonSql()
  const cur = await sql`
    SELECT showcase_status::text AS st
    FROM profiles WHERE id = ${userId} LIMIT 1
  `
  const st = String((cur[0] as { st?: string } | undefined)?.st ?? 'none')
  if (st === 'pending') {
    return { error: '已有申请正在审核中' }
  }
  if (st === 'approved') {
    return { error: '当前已公开发布，请先联系管理员撤销后再申请' }
  }
  await sql`
    UPDATE profiles
    SET
      showcase_title = ${title},
      showcase_summary = ${summary},
      showcase_status = 'pending',
      showcase_requested_at = now(),
      showcase_rejection_reason = NULL,
      showcase_reviewed_at = NULL,
      showcase_revoke_requested_at = NULL
    WHERE id = ${userId}
  `
  return {}
}

export async function neonRequestShowcaseRevokePublication(
  userId: string,
): Promise<{ error?: string }> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT showcase_status::text AS st,
           showcase_revoke_requested_at AS rq
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `
  const row = rows[0] as { st?: string; rq?: unknown } | undefined
  if (!row || String(row.st ?? '') !== 'approved') {
    return { error: '当前未处于公开发布状态' }
  }
  if (row.rq != null) {
    return { error: '已通知管理员撤销，请耐心等待处理' }
  }
  await sql`
    UPDATE profiles
    SET showcase_revoke_requested_at = now()
    WHERE id = ${userId}
      AND showcase_status = 'approved'
  `
  return {}
}

export async function neonListShowcasePendingProfiles(): Promise<Profile[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT p.*, ac.email AS registration_email
    FROM profiles p
    LEFT JOIN public.auth_credentials ac ON ac.user_id = p.id
    WHERE p.showcase_status = 'pending'
    ORDER BY p.showcase_requested_at ASC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map(mapProfileRow)
}

export type ApprovedShowcaseCard = {
  slug: string
  title: string
  summary: string
  display_name: string | null
  avatar_url: string | null
  reviewed_at: string
}

export async function neonListApprovedShowcaseCards(): Promise<
  ApprovedShowcaseCard[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT
      showcase_slug AS slug,
      showcase_title AS title,
      showcase_summary AS summary,
      display_name,
      avatar_url,
      showcase_reviewed_at AS reviewed_at
    FROM profiles
    WHERE showcase_status = 'approved'
      AND showcase_slug IS NOT NULL
      AND trim(showcase_slug) <> ''
    ORDER BY showcase_reviewed_at DESC NULLS LAST
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    slug: String(r.slug ?? '').trim(),
    title: String(r.title ?? ''),
    summary: String(r.summary ?? ''),
    display_name:
      r.display_name == null ? null : String(r.display_name),
    avatar_url: r.avatar_url == null ? null : String(r.avatar_url),
    reviewed_at:
      r.reviewed_at instanceof Date
        ? r.reviewed_at.toISOString()
        : String(r.reviewed_at ?? ''),
  }))
}

export async function neonListApprovedShowcasesAdmin(): Promise<
  {
    profileId: string
    slug: string
    title: string
    revoke_requested_at: string | null
  }[]
> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT id::text AS profile_id,
           showcase_slug AS slug,
           showcase_title AS title,
           showcase_revoke_requested_at AS revoke_requested_at
    FROM profiles
    WHERE showcase_status = 'approved'
      AND showcase_slug IS NOT NULL
      AND trim(showcase_slug) <> ''
    ORDER BY
      CASE WHEN showcase_revoke_requested_at IS NOT NULL THEN 0 ELSE 1 END,
      showcase_revoke_requested_at DESC NULLS LAST,
      showcase_reviewed_at DESC NULLS LAST
  `
  return (
    rows as {
      profile_id: string
      slug: string
      title: string
      revoke_requested_at: unknown
    }[]
  ).map((r) => ({
    profileId: String(r.profile_id ?? ''),
    slug: String(r.slug ?? '').trim(),
    title: String(r.title ?? ''),
    revoke_requested_at:
      r.revoke_requested_at instanceof Date
        ? r.revoke_requested_at.toISOString()
        : r.revoke_requested_at == null
          ? null
          : String(r.revoke_requested_at),
  }))
}

export async function neonListApprovedShowcaseSlugs(): Promise<string[]> {
  const sql = getNeonSql()
  const rows = await sql`
    SELECT showcase_slug AS slug
    FROM profiles
    WHERE showcase_status = 'approved'
      AND showcase_slug IS NOT NULL
      AND trim(showcase_slug) <> ''
  `
  return (rows as { slug: string }[])
    .map((r) => String(r.slug ?? '').trim())
    .filter((s) => s.length > 0)
}

export async function neonGetProfileByShowcaseSlugPublic(
  slug: string,
): Promise<Profile | null> {
  const norm = decodeURIComponent(slug ?? '').trim()
  if (!norm) return null
  const sql = getNeonSql()
  const rows = await sql`
    SELECT * FROM profiles
    WHERE showcase_slug = ${norm}
      AND showcase_status = 'approved'
    LIMIT 1
  `
  const r = rows[0] as Record<string, unknown> | undefined
  return r ? mapProfileRow(r) : null
}

export async function neonAdminApproveShowcaseApplication(input: {
  profileId: string
  slug: string
}): Promise<{ error?: string; slug?: string }> {
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  if (slug.length < 2) {
    return { error: 'slug 至少 2 个字符，可用字母数字与中文' }
  }
  const sql = getNeonSql()
  const clash = await sql`
    SELECT id FROM profiles
    WHERE showcase_slug = ${slug} AND id <> ${input.profileId}
    LIMIT 1
  `
  if (clash.length > 0) {
    return { error: '该 slug 已被占用，请换一个' }
  }
  const done = await sql`
    UPDATE profiles
    SET
      showcase_slug = ${slug},
      showcase_status = 'approved',
      showcase_reviewed_at = now(),
      showcase_rejection_reason = NULL,
      showcase_revoke_requested_at = NULL
    WHERE id = ${input.profileId}
      AND showcase_status = 'pending'
    RETURNING id
  `
  if (done.length === 0) {
    return { error: '该用户不是待审核状态' }
  }
  return { slug }
}

export async function neonAdminRejectShowcaseApplication(input: {
  profileId: string
  reason: string
}): Promise<void> {
  const reason = input.reason.trim()
  const sql = getNeonSql()
  await sql`
    UPDATE profiles
    SET
      showcase_status = 'rejected',
      showcase_reviewed_at = now(),
      showcase_rejection_reason = ${reason},
      showcase_slug = NULL
    WHERE id = ${input.profileId}
      AND showcase_status = 'pending'
  `
}

export async function neonAdminRevokeShowcasePublication(
  profileId: string,
): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE profiles
    SET
      showcase_status = 'none',
      showcase_slug = NULL,
      showcase_reviewed_at = now(),
      showcase_rejection_reason = '已由管理员撤销公开发布',
      showcase_revoke_requested_at = NULL
    WHERE id = ${profileId}
      AND showcase_status = 'approved'
  `
}

export async function neonAdminSetPortalDisabledByAdmin(input: {
  profileId: string
  disabled: boolean
}): Promise<void> {
  const sql = getNeonSql()
  await sql`
    UPDATE profiles
    SET portal_disabled_by_admin = ${input.disabled}
    WHERE id = ${input.profileId}
  `
}
