import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Lightbulb,
  PenTool,
  Rocket,
  Sparkles,
} from 'lucide-react'

/** 首页「按角色」与 `/role/[slug]` 共用的图标名 → Lucide 映射（与设计稿一致时可扩展）。 */
export const ROLE_LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Rocket,
  PenTool,
  Lightbulb,
  Sparkles,
}

export function roleLucideIcon(raw: string | null | undefined): LucideIcon {
  const key = raw?.trim()
  if (key && ROLE_LUCIDE_ICON_MAP[key]) return ROLE_LUCIDE_ICON_MAP[key]
  return Sparkles
}
