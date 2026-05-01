import type { LucideIcon } from 'lucide-react'
import {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
  Sparkles,
  Clock,
  LayoutGrid,
} from 'lucide-react'

/** 菜单项存储的图标名 → Lucide（与 categories.icon 对齐） */
export const navigationIconMap: Record<string, LucideIcon> = {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
  Sparkles,
  Clock,
  LayoutGrid,
}

export function navigationIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return Sparkles
  return navigationIconMap[iconName.trim()] ?? Sparkles
}
