'use client'

import Image from 'next/image'
import Link from 'next/link'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Sparkles, X } from 'lucide-react'
import type { Tool } from '@/lib/types'
import { recordToolViewBySlug } from '@/lib/client-record-tool-view'
import { toolPublicPath } from '@/lib/tool-public-path'
import { trimOrNull } from '@/lib/trim-or-null'
import { TOOL_TIP_CONTENT_CLASS } from '@/components/tool-card'
import { cn } from '@/lib/utils'

const blankRel = { target: '_blank' as const, rel: 'noopener noreferrer' as const }

function tooltipIntroPreview(tool: Tool): string {
  return (
    tool.introduction?.trim() ||
    tool.description ||
    ''
  ).trim()
}

/** 「我的关注」紧凑格：10 列网格中单格；hover 概述与首页 `ToolCard` 对齐（md+ tooltip）。 */
export function AccountFollowToolMiniTile({
  tool,
  onRemove,
}: {
  tool: Tool
  onRemove: () => void
}) {
  const logoSrc = trimOrNull(tool.logo_url)
  const detailHref = toolPublicPath(tool.slug)
  const text = tooltipIntroPreview(tool)

  const inner = (
    <div
      className={cn(
        'relative flex min-h-[52px] w-full min-w-0 items-center gap-2 rounded-lg border bg-card px-2 py-1.5 transition-colors hover:border-primary/35 hover:bg-muted/40',
      )}
    >
      <button
        type="button"
        aria-label={`取消关注 ${tool.name}`}
        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-destructive/15 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
      >
        <X className="h-3 w-3" />
      </button>
      <Link
        href={detailHref}
        {...blankRel}
        onClick={() => recordToolViewBySlug(tool.slug)}
        className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            fill
            className="object-cover"
            sizes="36px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
        )}
      </Link>
      <Link
        href={detailHref}
        {...blankRel}
        onClick={() => recordToolViewBySlug(tool.slug)}
        className="min-w-0 flex-1 py-0.5 outline-none"
      >
        <p className="truncate text-[11px] font-semibold leading-tight text-foreground">
          {tool.name}
        </p>
      </Link>
    </div>
  )

  if (!text) {
    return inner
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="block min-w-0 max-w-full">{inner}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={10}
          avoidCollisions
          className={cn(TOOL_TIP_CONTENT_CLASS, 'hidden md:block')}
        >
          <p className="line-clamp-2 max-w-[300px] whitespace-pre-wrap text-center text-xs leading-relaxed text-white">
            {text}
          </p>
          <Tooltip.Arrow className="fill-neutral-950" width={12} height={6} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
