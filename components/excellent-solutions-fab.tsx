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
      className={cn(
        'fixed bottom-6 right-4 z-40 flex max-w-[min(calc(100vw-2rem),14rem)] items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground md:text-sm',
      )}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="leading-tight">优秀 AI 解决方案</span>
    </Link>
  )
}
