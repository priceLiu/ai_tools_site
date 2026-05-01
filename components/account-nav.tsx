'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ClipboardList,
  Plus,
  History,
  User,
  Home,
} from 'lucide-react'
import { AccountLogoutButton } from '@/components/account-logout-button'

const items = [
  { href: '/account/pending', label: '审核中的工具', icon: ClipboardList },
  { href: '/submit', label: 'AI 工具提交', icon: Plus },
  { href: '/account/history', label: '工具提交历史', icon: History },
  { href: '/account/profile', label: '个人信息', icon: User },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/submit') return pathname === '/submit'
  if (href === '/account/history') {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith('/account/submissions/')
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface AccountNavProps {
  email: string
  avatarUrl: string | null
}

export function AccountNav({ email, avatarUrl }: AccountNavProps) {
  const pathname = usePathname()

  return (
    <aside className="flex min-h-[calc(100vh-4rem)] w-52 shrink-0 flex-col border-r border-border bg-card px-3 py-4 md:w-56">
      <div className="mb-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
            )}
          </div>
          <span className="font-semibold text-foreground">个人中心</span>
        </div>
        <p className="mt-2 truncate px-1 text-xs text-muted-foreground" title={email}>
          {email || '—'}
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        <Link
          href="/"
          className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Home className="h-4 w-4 shrink-0" />
          返回首页
        </Link>
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border pt-4">
        <AccountLogoutButton />
      </div>
    </aside>
  )
}
