import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import type { HomeListedTool } from '@/lib/types'
import { Flame, Clock } from 'lucide-react'

interface ToolSectionProps {
  title: string
  tools: HomeListedTool[]
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
  if (tools.length === 0 && (icon === 'hot' || icon === 'new')) {
    return null
  }

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
      {tools.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          暂无已通过审核的工具收录，可先
          <a href="/submit" className="underline underline-offset-2">
            提交工具
          </a>
          。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tools.map((tool, idx) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              imagePriority={idx < imagePriorityFirstN}
              fluid
            />
          ))}
        </div>
      )}
    </section>
  )
}
