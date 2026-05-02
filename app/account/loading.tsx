import { Bot } from 'lucide-react'

/** 个人中心内路由切换时显示（layout 保留，仅页面槽位进入 Suspense） */
export default function AccountLoading() {
  return (
    <div
      className="flex min-h-[min(420px,60vh)] flex-col items-center justify-center gap-5 px-4 py-12"
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
    >
      <div className="flex items-end gap-1">
        <Bot
          className="h-14 w-14 motion-safe:animate-[bot-run_0.75s_ease-in-out_infinite] text-primary"
          aria-hidden
        />
        <span
          className="text-2xl leading-none motion-safe:animate-bounce motion-reduce:animate-none"
          aria-hidden
        >
          🏃
        </span>
      </div>
      <p className="max-w-sm text-center text-base font-medium text-foreground">
        机器人奔跑中，等等就好哈...
      </p>
    </div>
  )
}
