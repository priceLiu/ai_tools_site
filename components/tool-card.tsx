'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import Link from 'next/link'
import Image from 'next/image'
import type { Tool } from '@/lib/types'
import { recordToolViewBySlug } from '@/lib/client-record-tool-view'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Bot, Eye, Heart } from 'lucide-react'

const TOOL_TIP_CONTENT_CLASS =
  'z-50 max-w-[340px] rounded-lg border-0 bg-neutral-950 px-4 py-3 text-xs text-white shadow-xl'

interface ToolCardProps {
  tool: Tool
  /** 站点收藏总数；不传则读 tool.favorite_count */
  favoritesCount?: number
  /** 首屏条目传 true：优先解码 logo */
  imagePriority?: boolean
}

export const TOOL_CARD_WIDTH = 350
export const TOOL_CARD_HEIGHT = 100

const blankRel = { target: '_blank' as const, rel: 'noopener noreferrer' as const }

export function ToolCard({
  tool,
  favoritesCount,
  imagePriority = false,
}: ToolCardProps) {
  const views = tool.view_count ?? 0
  const fav = favoritesCount ?? tool.favorite_count ?? 0
  const catName = tool.category?.name ?? 'AI工具'
  const tooltipText = (
    tool.introduction?.trim() ||
    tool.description ||
    ''
  ).trim()

  const detailHref = `/tool/${tool.slug}`

  const cardInner = (
    <Card
      className="group flex min-h-0 w-full cursor-pointer flex-1 overflow-hidden transition-all hover:border-primary/30 hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
      style={{ height: TOOL_CARD_HEIGHT }}
    >
      <CardContent className="flex h-full w-full items-center gap-2.5 px-2.5 py-2">
        <Link
          href={detailHref}
          {...blankRel}
          onClick={() => recordToolViewBySlug(tool.slug)}
          className="relative block h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-muted outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${tool.name}（在新标签打开）`}
        >
          {tool.logo_url ? (
            <Image
              src={tool.logo_url}
              alt=""
              fill
              className="object-cover"
              priority={imagePriority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          )}
        </Link>
        <Link
          href={detailHref}
          onClick={() => recordToolViewBySlug(tool.slug)}
          className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1 outline-none"
        >
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {tool.name}
          </h3>
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">
            {tool.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
            <span className="inline-flex max-w-[7.5rem] items-center gap-0.5 truncate rounded-full bg-muted px-1.5 py-px font-medium text-foreground">
              <Bot className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{catName}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
              <Eye className="h-3 w-3 shrink-0" aria-hidden />
              {views.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
              <Heart
                className="h-3 w-3 shrink-0 text-red-500/75"
                aria-hidden
              />
              {fav.toLocaleString()}
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  )

  const wrapped = (
    <div
      className="inline-flex shrink-0 outline-none"
      style={{
        width: TOOL_CARD_WIDTH,
        minHeight: TOOL_CARD_HEIGHT,
        maxHeight: TOOL_CARD_HEIGHT,
      }}
    >
      {cardInner}
    </div>
  )

  if (!tooltipText) {
    return wrapped
  }

  return (
    <Tooltip.Provider delayDuration={280}>
      <Tooltip.Root delayDuration={280}>
        <Tooltip.Trigger asChild>
          <span
            className="inline-flex shrink-0"
            style={{ width: TOOL_CARD_WIDTH, maxWidth: '100%' }}
          >
            {wrapped}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={10}
            avoidCollisions
            className={TOOL_TIP_CONTENT_CLASS}
          >
            <p className="line-clamp-2 max-w-[300px] whitespace-pre-wrap text-center text-xs leading-relaxed text-white">
              {tooltipText}
            </p>
            <Tooltip.Arrow className="fill-neutral-950" width={12} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
