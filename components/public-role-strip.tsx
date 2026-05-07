import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { HomeRoleStripItem } from '@/lib/cached-home-role-strip'
import { roleLucideIcon } from '@/lib/role-lucide-icons'
import { rolePublicPath } from '@/lib/tag-slug'

/**
 * 全站头部搜索框下方的「按角色」横条（与运营设计稿：浅紫底、白底描边胶囊、左文案「按角色：」）。
 */
export function PublicRoleStrip({ roles }: { roles: HomeRoleStripItem[] }) {
  if (roles.length === 0) return null

  return (
    <div className="border-t border-border/45 bg-[#F3F4F9]">
      <div
        className={cn(
          'flex items-center gap-2 overflow-x-auto px-3 py-1.5 md:gap-2 md:px-6 md:py-2',
          '[scrollbar-width:thin]',
          '[&::-webkit-scrollbar]:h-1',
        )}
      >
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          按角色：
        </span>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 md:gap-2">
          {roles.map((r) => {
            const Icon = roleLucideIcon(r.icon)
            const tip = r.tagline?.trim() ? r.tagline.trim() : r.name
            return (
              <Link
                key={r.slug}
                href={rolePublicPath(r.slug)}
                aria-label={`${r.name}：${tip}`}
                title={tip}
                className="inline-flex"
              >
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-primary/45 bg-white px-2 py-0.5',
                    'text-[11px] font-medium leading-snug text-foreground shadow-sm',
                    'transition-colors hover:border-primary hover:bg-primary/5 md:text-xs',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0 text-primary/90 md:h-3.5 md:w-3.5" />
                  {r.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
