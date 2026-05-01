import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Eye, Heart, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Tool } from '@/lib/types'

interface ToolListRowCardProps {
  tool: Tool
  /** Opens when user clicks the logo */
  logoHref: string
  /** Title link; defaults to logoHref */
  titleHref?: string
  /** Logo 与标题链接是否在新标签页打开 */
  openLinksInNewTab?: boolean
  favoritesCount?: number
  statusBadge?: ReactNode
  /** Extra rows under metrics (submission date, website, actions, alerts) */
  footer?: ReactNode
  className?: string
}

export function ToolListRowCard({
  tool,
  logoHref,
  titleHref,
  openLinksInNewTab = false,
  favoritesCount = 0,
  statusBadge,
  footer,
  className,
}: ToolListRowCardProps) {
  const nameHref = titleHref ?? logoHref
  const views = tool.view_count ?? 0
  const fav = favoritesCount ?? tool.favorite_count ?? 0

  const linkProps = openLinksInNewTab
    ? ({ target: '_blank' as const, rel: 'noopener noreferrer' as const })
    : {}

  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start gap-4 p-4">
        <Link
          href={logoHref}
          {...linkProps}
          className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
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
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={nameHref}
              {...linkProps}
              className="min-w-0 truncate text-base font-semibold text-foreground hover:text-primary"
            >
              {tool.name}
            </Link>
            {statusBadge ? (
              <div className="shrink-0">{statusBadge}</div>
            ) : null}
          </div>

          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tool.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {tool.category ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground">
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

          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      </CardContent>
    </Card>
  )
}
