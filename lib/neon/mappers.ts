import type { Category, Favorite, Profile, Tool, ToolComment, ToolTagLink } from '@/lib/types'
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
