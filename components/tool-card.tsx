'use client'

import { useEffect, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import Link from 'next/link'
import Image from 'next/image'
import type { HomeListedTool } from '@/lib/types'
import { recordToolViewBySlug } from '@/lib/client-record-tool-view'
import { toolPublicPath } from '@/lib/tool-public-path'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { trimOrNull } from '@/lib/trim-or-null'
import { Sparkles, Bot, Eye, Heart } from 'lucide-react'

/**
 * 全局 Tooltip Provider 在 `app/layout.tsx`，这里只用 Tooltip.Root；
 * 不再每张卡片重复挂 Provider —— 长列表性能差异显著。
 * `hidden md:inline-flex` 让移动端整段 Tooltip 不进 DOM，进一步省事件监听。
 */

const TOOL_TIP_CONTENT_CLASS =
  'z-50 max-w-[340px] rounded-lg border-0 bg-neutral-950 px-4 py-3 text-xs text-white shadow-xl'

interface ToolCardProps {
  tool: HomeListedTool
  /** 站点收藏总数；不传则读 tool.favorite_count */
  favoritesCount?: number
  /** 首屏条目传 true：优先解码 logo */
  imagePriority?: boolean
  /**
   * 铺满网格单元（首页 5 列等）；默认 false 为固定约 350px 宽（分类页等）
   */
  fluid?: boolean
}

export const TOOL_CARD_WIDTH = 350
export const TOOL_CARD_HEIGHT = 100

const blankRel = { target: '_blank' as const, rel: 'noopener noreferrer' as const }

function listingDescriptionLine(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

export function ToolCard({
  tool,
  favoritesCount,
  imagePriority = false,
  fluid = false,
}: ToolCardProps) {
  const views = tool.view_count ?? 0
  const fav = favoritesCount ?? tool.favorite_count ?? 0
  const catName = tool.category?.name ?? 'AI工具'
  const logoSrc = trimOrNull(tool.logo_url)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setLogoFailed(false)
  }, [tool.id, logoSrc])
  const showLogoImage = Boolean(logoSrc && !logoFailed)
  const tooltipText = (
    tool.introduction?.trim() ||
    tool.description ||
    ''
  ).trim()
  const descLine = listingDescriptionLine(tool.description)

  const detailHref = toolPublicPath(tool.slug)
  const logoBox = fluid ? 'h-[58px] w-[58px]' : 'h-[68px] w-[68px]'

  const cardInner = (
    <Card
      className="group flex min-h-0 w-full cursor-pointer flex-1 overflow-hidden transition-all hover:border-primary/30 hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
      style={{ height: TOOL_CARD_HEIGHT }}
    >
      <CardContent
        className={cn(
          'flex h-full w-full items-center px-2.5 py-2',
          fluid ? 'gap-2' : 'gap-2.5',
        )}
      >
        <Link
          href={detailHref}
          {...blankRel}
          onClick={() => recordToolViewBySlug(tool.slug)}
          className={cn(
            'relative block shrink-0 overflow-hidden rounded-lg bg-muted outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring',
            logoBox,
          )}
          aria-label={`${tool.name}（在新标签打开）`}
        >
          {showLogoImage ? (
            <Image
              src={logoSrc!}
              alt=""
              fill
              className="object-cover"
              priority={imagePriority}
              onError={() => setLogoFailed(true)}
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
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col justify-center outline-none',
            fluid ? 'gap-0.5' : 'gap-1',
          )}
        >
          <h3
            className={cn(
              'truncate font-semibold leading-tight text-foreground transition-colors group-hover:text-primary',
              fluid ? 'text-xs' : 'text-sm',
            )}
          >
            {tool.name}
          </h3>
          <p
            className={cn(
              'min-h-0 leading-snug text-muted-foreground',
              fluid
                ? 'line-clamp-2 text-[10px]'
                : 'line-clamp-1 text-[11px]',
            )}
          >
            {descLine}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-muted-foreground sm:gap-x-2">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 truncate rounded-full bg-muted px-1.5 py-px font-medium text-foreground',
                fluid ? 'max-w-[4.5rem]' : 'max-w-[7.5rem]',
              )}
            >
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

  const wrapped = fluid ? (
    <div
      className="block w-full min-w-0 outline-none"
      style={{
        minHeight: TOOL_CARD_HEIGHT,
        maxHeight: TOOL_CARD_HEIGHT,
      }}
    >
      {cardInner}
    </div>
  ) : (
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
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={cn(
            fluid ? 'block min-w-0 max-w-full' : 'inline-flex shrink-0',
          )}
          style={
            fluid ? undefined : { width: TOOL_CARD_WIDTH, maxWidth: '100%' }
          }
        >
          {wrapped}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={10}
          avoidCollisions
          className={cn(TOOL_TIP_CONTENT_CLASS, 'hidden md:block')}
        >
          <p className="line-clamp-2 max-w-[300px] whitespace-pre-wrap text-center text-xs leading-relaxed text-white">
            {tooltipText}
          </p>
          <Tooltip.Arrow className="fill-neutral-950" width={12} height={6} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
