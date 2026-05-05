import type {
  AdPlacement,
  AdminCommentRow,
  Category,
  Favorite,
  Profile,
  Tool,
  ToolComment,
  ToolTagLink,
} from '@/lib/types'
import { trimOrNullImageSrc } from '@/lib/trim-or-null'

export function asIso(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  return String(v)
}

export function parseCategoryJson(raw: unknown): Category | undefined {
  if (raw == null) return undefined
  if (typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (r.id == null) return undefined
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
    created_at: asIso(r.created_at),
  }
}

export function mapToolRow(
  r: Record<string, unknown>,
  category?: Category | null,
  toolTags?: ToolTagLink[] | null,
): Tool {
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    description: String(r.description ?? ''),
    website_url: String(r.website_url ?? ''),
    logo_url: trimOrNullImageSrc(r.logo_url),
    screenshot_url: trimOrNullImageSrc(r.screenshot_url),
    category_id: r.category_id == null ? null : String(r.category_id),
    user_id: r.user_id == null ? null : String(r.user_id),
    status: r.status as Tool['status'],
    rejection_reason:
      r.rejection_reason == null ? null : String(r.rejection_reason),
    is_featured: Boolean(r.is_featured),
    is_disabled: r.is_disabled === true,
    view_count: Number(r.view_count ?? 0),
    favorite_count:
      r.favorite_count == null ? undefined : Number(r.favorite_count),
    introduction: r.introduction == null ? null : String(r.introduction),
    introduction_format:
      (r.introduction_format as Tool['introduction_format']) ?? 'markdown',
    use_cases: r.use_cases == null ? null : String(r.use_cases),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
    category: category ?? undefined,
    tool_tags: toolTags ?? undefined,
  }
}

export function mapProfileRow(r: Record<string, unknown>): Profile {
  return {
    id: String(r.id),
    display_name: r.display_name == null ? null : String(r.display_name),
    avatar_url: r.avatar_url == null ? null : String(r.avatar_url),
    is_admin: Boolean(r.is_admin),
    is_disabled: r.is_disabled === true,
    disabled_reason:
      r.disabled_reason === undefined || r.disabled_reason === null
        ? null
        : String(r.disabled_reason),
    comment_muted: r.comment_muted === true,
    comment_mute_reason:
      r.comment_mute_reason === undefined || r.comment_mute_reason === null
        ? null
        : String(r.comment_mute_reason),
    registration_email:
      r.registration_email === undefined || r.registration_email === null
        ? null
        : String(r.registration_email),
    created_at: asIso(r.created_at),
  }
}

export function mapCommentRow(r: Record<string, unknown>): ToolComment {
  return {
    id: String(r.id),
    tool_id: String(r.tool_id),
    body: String(r.body),
    nickname: String(r.nickname ?? ''),
    email: String(r.email ?? ''),
    website: r.website == null ? null : String(r.website),
    created_at: asIso(r.created_at),
    user_id:
      r.user_id == null || String(r.user_id).trim() === ''
        ? null
        : String(r.user_id),
    is_hidden: r.is_hidden === true,
  }
}

export function mapAdminCommentRow(r: Record<string, unknown>): AdminCommentRow {
  const base = mapCommentRow(r)
  return {
    ...base,
    tool_name: String(r.tool_name ?? ''),
    tool_slug: String(r.tool_slug ?? ''),
  }
}

export function mapAdRow(r: Record<string, unknown>): AdPlacement {
  const placement = String(r.placement ?? 'section1')
  const tab = r.tab_key
  return {
    id: String(r.id),
    tool_id: String(r.tool_id),
    placement: (placement === 'section2' ? 'section2' : 'section1') as
      | 'section1'
      | 'section2',
    tab_key:
      tab == null
        ? null
        : String(tab) === 'A'
          ? 'A'
          : String(tab) === 'B'
            ? 'B'
            : String(tab) === 'C'
              ? 'C'
              : null,
    banner_url:
      r.banner_url == null || String(r.banner_url).trim() === ''
        ? null
        : String(r.banner_url),
    price: Number(r.price ?? 0),
    starts_at: asIso(r.starts_at),
    ends_at: asIso(r.ends_at),
    status: r.status as AdPlacement['status'],
    rejection_reason:
      r.rejection_reason == null ? null : String(r.rejection_reason),
    sort_order: Number(r.sort_order ?? 0),
    submitted_by: r.submitted_by == null ? null : String(r.submitted_by),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
    tool:
      r.tool_name == null
        ? undefined
        : {
            id: String(r.tool_id),
            name: String(r.tool_name),
            slug: String(r.tool_slug ?? ''),
            description: String(r.tool_description ?? ''),
            logo_url: trimOrNullImageSrc(r.tool_logo_url),
          },
  }
}

export function mapFavoriteJoinedRow(
  fav: Record<string, unknown>,
  toolRow: Record<string, unknown>,
  cat: Category | null,
): Favorite {
  const tool = mapToolRow(toolRow, cat)
  return {
    id: String(fav.id),
    user_id: String(fav.user_id),
    tool_id: String(fav.tool_id),
    created_at: asIso(fav.created_at),
    tool,
  }
}
