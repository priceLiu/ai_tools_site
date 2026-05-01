import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import type { Tool } from '@/lib/types'
import { Flame, Clock } from 'lucide-react'

interface ToolSectionProps {
  title: string
  tools: Tool[]
  icon?: 'hot' | 'new'
  /** 首页锚点 id，用于侧边栏平滑滚动定位 */
  anchorId?: string
  /** 前 N 张列表图使用 loading=priority，改善首屏；其余惰性解码 */
  imagePriorityFirstN?: number
}

export function ToolSection({
  title,
  tools,
  icon,
  anchorId,
  imagePriorityFirstN = 0,
}: ToolSectionProps) {
  if (tools.length === 0) return null

  return (
    <section
      id={anchorId}
      className="scroll-mt-24 space-y-4"
      aria-labelledby={anchorId ? `${anchorId}-heading` : undefined}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="gap-1 px-3 py-1"
          id={anchorId ? `${anchorId}-heading` : undefined}
        >
          {icon === 'hot' && (
            <Flame className="h-3.5 w-3.5 text-orange-500" />
          )}
          {icon === 'new' && (
            <Clock className="h-3.5 w-3.5 text-blue-500" />
          )}
          <span className="font-medium">{title}</span>
        </Badge>
      </div>
      <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
        {tools.map((tool, idx) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            imagePriority={idx < imagePriorityFirstN}
          />
        ))}
      </div>
    </section>
  )
}
