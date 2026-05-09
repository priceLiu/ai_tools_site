'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { excellentSolutionsListPath } from '@/lib/account-portal-path'

export function ExcellentSolutionsFab() {
  const pathname = usePathname() ?? ''

  const hide =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/diag') ||
    pathname.startsWith('/echo')

  if (hide) return null

  return (
    <Link
      href={excellentSolutionsListPath()}
      title="AI 方案集"
      aria-label="打开 AI 方案集"
      className={cn(
        'fixed right-0 top-[calc(100vh/3)] z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl py-4 pl-3',
        'pr-[max(0.75rem,env(safe-area-inset-right))]',
        'bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-92',
        'min-w-[2.75rem] border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
      <span className="text-[13px] font-semibold leading-none tracking-[0.12em] [writing-mode:vertical-rl]">
        AI方案集
      </span>
    </Link>
  )
}
