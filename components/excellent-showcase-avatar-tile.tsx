'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import Image from 'next/image'
import Link from 'next/link'
import { User } from 'lucide-react'
import { TOOL_TIP_CONTENT_CLASS } from '@/components/tool-card'
import { cn } from '@/lib/utils'

export function ExcellentShowcaseAvatarTile(props: {
  slug: string
  title: string
  summary: string
  displayName: string | null
  avatarUrl: string | null
  priority?: boolean
}) {
  const { slug, title, summary, displayName, avatarUrl, priority } = props
  const href = `/excellent-ai-solutions/${encodeURIComponent(slug)}`
  const headline = (title || '未命名方案').trim()
  const overview = (summary || '').replace(/\s+/g, ' ').trim()
  const subtitle =
    overview ||
    (displayName?.trim() ? `${displayName.trim()} · 点击查看方案` : '点击查看方案')

  const tooltipInner = (
    <div className="space-y-2 text-left">
      <p className="font-semibold text-white">{headline}</p>
      <p className="max-w-[320px] whitespace-pre-wrap text-[11px] leading-relaxed text-white/90">
        {overview || '作者尚未填写简介。'}
      </p>
      {displayName?.trim() ? (
        <p className="text-[10px] text-white/65">创作者 · {displayName.trim()}</p>
      ) : null}
    </div>
  )

  const cardClassName = cn(
    'group flex aspect-square w-full min-w-0 flex-col items-center justify-between rounded-xl border border-border/80 bg-card/95 p-2.5 shadow-sm ring-1 ring-black/[0.04] transition-[border-color,box-shadow,transform]',
    'hover:z-10 hover:border-primary/40 hover:shadow-md hover:ring-primary/12',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  )

  const cardInner = (
    <>
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 pt-0.5">
        <div className="relative aspect-square w-[42%] max-h-[3.75rem] max-w-[3.75rem] min-h-[2.5rem] min-w-[2.5rem] shrink-0 overflow-hidden rounded-full border-2 border-background shadow-md ring-2 ring-primary/10 transition-transform group-hover:ring-primary/25 md:max-h-[4rem] md:max-w-[4rem]">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:1280px) 12vw, 104px"
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <User className="h-7 w-7 md:h-8 md:w-8" aria-hidden />
            </div>
          )}
        </div>
        <h2 className="line-clamp-2 w-full px-0.5 text-center text-[11px] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary md:text-xs">
          {headline}
        </h2>
      </div>
      <p className="line-clamp-1 w-full px-0.5 text-center text-[10px] leading-snug text-muted-foreground md:text-[11px]">
        {subtitle}
      </p>
    </>
  )

  return (
    <Tooltip.Root delayDuration={280}>
      <Tooltip.Trigger asChild>
        <Link href={href} className={cardClassName}>
          {cardInner}
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={10}
          avoidCollisions
          className={cn(TOOL_TIP_CONTENT_CLASS, 'hidden md:block')}
        >
          {tooltipInner}
          <Tooltip.Arrow className="fill-neutral-950" width={12} height={6} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
