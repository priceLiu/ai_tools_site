'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Sparkles,
  Shield,
  ClipboardList,
  Plus,
  History,
  User,
  LayoutGrid,
  Users,
  Upload,
} from 'lucide-react'

type Variant = 'default' | 'admin'

interface CompactAppSidebarProps {
  variant?: Variant
}

function isPersonalAreaActive(pathname: string, href: string) {
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

export function CompactAppSidebar({ variant = 'default' }: CompactAppSidebarProps) {
  const pathname = usePathname()
  const isAdmin = variant === 'admin'

  const homeActive = pathname === '/'

  const personalLinks = [
    { href: '/account/pending', label: '审核中的工具', icon: ClipboardList },
    {
      href: '/submit',
      label: 'AI 工具提交',
      icon: Plus,
    },
    { href: '/account/history', label: '工具提交历史', icon: History },
    { href: '/account/profile', label: '个人信息', icon: User },
  ] as const

  const navigationAdminActive = pathname.startsWith('/admin/navigation')
  const usersAdminActive = pathname.startsWith('/admin/users')
  const importAdminActive = pathname.startsWith('/admin/import-tools')
  const reviewsAdminActive =
    pathname.startsWith('/admin') &&
    !navigationAdminActive &&
    !usersAdminActive &&
    !importAdminActive

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen w-52 flex-col border-r border-border bg-sidebar md:w-56',
      )}
    >
      <div className="flex h-full flex-col px-3 py-4">
        <Link
          href="/"
          className="mb-4 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground">AI工具集</span>
        </Link>

        {isAdmin && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-foreground">管理后台</span>
          </div>
        )}

        <nav className="flex flex-col gap-0.5">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              homeActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            返回首页
          </Link>

          {!isAdmin && (
            <>
              <p className="mb-1 mt-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                个人相关
              </p>
              {personalLinks.map(({ href, label, icon: Icon }) => {
                const active = isPersonalAreaActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </>
          )}

          {isAdmin && (
            <>
              <Link
                href="/admin"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  reviewsAdminActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                )}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                审核列表
              </Link>
              <Link
                href="/admin/import-tools"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  importAdminActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                )}
              >
                <Upload className="h-4 w-4 shrink-0" />
                批量导入
              </Link>
              <Link
                href="/admin/navigation"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  navigationAdminActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                )}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" />
                菜单管理
              </Link>
              <Link
                href="/admin/users"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  usersAdminActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                用户管理
              </Link>
            </>
          )}
        </nav>
      </div>
    </aside>
  )
}
