'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Tool } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Bot, Eye, Heart } from 'lucide-react'

interface ToolCardProps {
  tool: Tool
  /** 站点收藏总数；不传则视为 0 */
  favoritesCount?: number
}

export function ToolCard({ tool, favoritesCount = 0 }: ToolCardProps) {
  const views = tool.view_count ?? 0
  const catName = tool.category?.name ?? 'AI工具'

  return (
    <Link href={`/tool/${tool.slug}`}>
      <Card className="group h-full cursor-pointer transition-all hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
            {tool.logo_url ? (
              <Image
                src={tool.logo_url}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
            )}
          </div>
          <div className="flex min-h-[4.75rem] min-w-0 flex-1 flex-col justify-between gap-1">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                {tool.name}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                <Bot className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{catName}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {views.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 shrink-0 text-red-500/75" aria-hidden />
                {favoritesCount.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
