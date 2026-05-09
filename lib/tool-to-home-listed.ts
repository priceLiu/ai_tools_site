import type { HomeListedTool, Tool } from '@/lib/types'

/** 门户 / 列表卡片：从完整 Tool 降为 HomeListedTool */
export function toolToHomeListed(tool: Tool): HomeListedTool {
  return {
    id: tool.id,
    name: tool.name,
    slug: tool.slug,
    description: tool.description,
    logo_url: tool.logo_url,
    category_id: tool.category_id,
    view_count: tool.view_count,
    is_featured: tool.is_featured,
    status: tool.status,
    created_at: tool.created_at,
    updated_at: tool.updated_at,
    favorite_count: tool.favorite_count,
    is_disabled: tool.is_disabled,
    category: tool.category,
    introduction: tool.introduction,
  }
}
