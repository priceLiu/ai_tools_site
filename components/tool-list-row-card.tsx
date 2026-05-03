'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Eye, Heart, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Tool } from '@/lib/types'
import { recordToolViewBySlug } from '@/lib/client-record-tool-view'

interface ToolListRowCardProps {
  tool: Tool
  /** 左侧控件（如管理端多选框），置于 Logo 之前 */
  leadingControl?: ReactNode
  /** Opens when user clicks the logo */
  logoHref: string
  /** Title link; defaults to logoHref */
  titleHref?: string
  /** 仅工具 Logo 在新标签打开 */
  openLogoInNewTab?: boolean
  /** 标题是否在新标签打开 */
  openTitleInNewTab?: boolean
  favoritesCount?: number
  statusBadge?: ReactNode
  /** Extra rows under metrics (submission date, website, actions, alerts) */
  footer?: ReactNode
  className?: string
  /** 管理后台等场景：更紧凑的边距与字号 */
  density?: 'default' | 'compact'
  /** 传入已通过工具的 slug 时，点击跳转会记入访问量（进入 /tool/slug） */
  recordViewSlug?: string | null
}

export function ToolListRowCard({
  tool,
  logoHref,
  titleHref,
  openLogoInNewTab = false,
  openTitleInNewTab = false,
  favoritesCount = 0,
  statusBadge,
  footer,
  className,
  density = 'default',
  recordViewSlug = null,
  leadingControl,
}: ToolListRowCardProps) {
  const nameHref = titleHref ?? logoHref
  const bumpView = () => {
    if (recordViewSlug) recordToolViewBySlug(recordViewSlug)
  }
  const views = tool.view_count ?? 0
  const fav = favoritesCount ?? tool.favorite_count ?? 0
  const compact = density === 'compact'

  const logoTabProps = openLogoInNewTab
    ? ({ target: '_blank' as const, rel: 'noopener noreferrer' as const })
    : {}
  const titleTabProps = openTitleInNewTab
    ? ({ target: '_blank' as const, rel: 'noopener noreferrer' as const })
    : {}

  return (
    <Card className={cn(className)}>
      <CardContent
        className={cn(
          'flex items-start',
          compact ? 'gap-2.5 px-3 py-2' : 'gap-4 p-4',
        )}
      >
        {leadingControl ? (
          <div
            className="shrink-0 pt-0.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {leadingControl}
          </div>
        ) : null}
        <Link
          href={logoHref}
          {...logoTabProps}
          onClick={bumpView}
          className={cn(
            'relative block shrink-0 overflow-hidden rounded-lg bg-muted outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring',
            compact ? 'h-12 w-12 rounded-md' : 'h-16 w-16 rounded-xl',
          )}
        >
          {tool.logo_url ? (
            <Image
              src={tool.logo_url}
              alt={tool.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
              <Sparkles
                className={cn('text-primary', compact ? 'h-6 w-6' : 'h-8 w-8')}
              />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={nameHref}
              {...titleTabProps}
              onClick={bumpView}
              className={cn(
                'min-w-0 truncate font-semibold text-foreground hover:text-primary',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {tool.name}
            </Link>
            {statusBadge ? (
              <div className="shrink-0">{statusBadge}</div>
            ) : null}
          </div>

          <p
            className={cn(
              'truncate text-muted-foreground',
              compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm',
            )}
          >
            {tool.description}
          </p>

          <div
            className={cn(
              'flex flex-wrap items-center text-muted-foreground',
              compact ? 'mt-1 gap-1.5 text-[11px]' : 'mt-2 gap-2 text-xs',
            )}
          >
            {tool.category ? (
              <span
                className={cn(
                  'rounded-full bg-muted font-medium text-foreground',
                  compact ? 'px-2 py-px text-[11px]' : 'px-2.5 py-0.5',
                )}
              >
                {tool.category.name}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{views.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 shrink-0 text-red-500/80" aria-hidden />
              <span>{fav.toLocaleString()}</span>
            </span>
          </div>

          {footer ? (
            <div className={compact ? 'mt-1.5' : 'mt-3'}>{footer}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
