'use client'

import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 前台页面数据加载中的占位文案（工具详情等客户端拉取场景） */
export function FrontendLoadingHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-4 py-12',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="内容加载中"
    >
      <div className="flex items-end gap-1">
        <Bot
          className="h-12 w-12 motion-safe:animate-[bot-run_0.75s_ease-in-out_infinite] text-primary"
          aria-hidden
        />
        <span
          className="text-xl leading-none motion-safe:animate-bounce motion-reduce:animate-none"
          aria-hidden
        >
          🏃
        </span>
      </div>
      <p className="max-w-sm text-center text-sm font-medium text-muted-foreground">
        机器人在搬运工具中. 一会就好...
      </p>
    </div>
  )
}
