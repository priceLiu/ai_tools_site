import Link from 'next/link'
import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import type { Tool } from '@/lib/types'
import { Flame, Clock, ChevronRight } from 'lucide-react'

interface ToolSectionProps {
  title: string
  tools: Tool[]
  icon?: 'hot' | 'new'
  href?: string
  favoriteCounts?: Record<string, number>
}

export function ToolSection({
  title,
  tools,
  icon,
  href,
  favoriteCounts,
}: ToolSectionProps) {
  if (tools.length === 0) return null
  
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            {icon === 'hot' && <Flame className="h-3.5 w-3.5 text-orange-500" />}
            {icon === 'new' && <Clock className="h-3.5 w-3.5 text-blue-500" />}
            <span className="font-medium">{title}</span>
          </Badge>
        </div>
        {href && (
          <Link 
            href={href}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            查看更多
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            favoritesCount={favoriteCounts?.[tool.id] ?? 0}
          />
        ))}
      </div>
    </section>
  )
}
