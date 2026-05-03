import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ToolTagsBar({
  labels,
  className,
}: {
  labels: string[]
  className?: string
}) {
  if (!labels.length) return null
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-gradient-to-br from-muted/50 via-card to-muted/30 px-4 py-3.5 shadow-sm',
        className,
      )}
      aria-label="工具标签"
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tag className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
        <span>标签</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {labels.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:bg-primary/15"
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
