'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { NavigationMenuTreeNode } from '@/lib/types'
import { slugFromCategoryMenuHref } from '@/lib/submit-category-choices'
import { navigationIcon } from '@/lib/navigation-icons'
import { ChevronDown, Plus, Sparkles, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

function scrollToAnchorId(id: string) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/**
 * 侧栏里对应首页某个锚点区块的 DOM id（#hot、或 /category/slug → home-cat-slug）。
 * 仅在传入 enableHomeAnchors 的页面参与导航；从详情/分类等页用 `/#id` 回到首页并定位。
 */
function homeSectionAnchorId(href: string): string | null {
  const t = href.trim()
  if (t.startsWith('#')) {
    const id = t.slice(1)
    return id.length > 0 ? id : null
  }
  const slug = slugFromCategoryMenuHref(t)
  return slug ? `home-cat-${slug}` : null
}

interface SidebarProps {
  navigation: NavigationMenuTreeNode[]
  enableHomeAnchors?: boolean
}

function itemRowClass(active: boolean) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/80',
  )
}

function routeActive(pathname: string | null, href: string): boolean {
  if (!pathname || href.startsWith('#') || href.startsWith('http')) return false
  const u = href.split('?')[0]
  return pathname === u || pathname.startsWith(`${u}/`)
}

function LeafLink({
  href,
  label,
  Icon,
  pathname,
  enableHomeAnchors,
  activeHomeAnchorId,
  onHomeSectionNavigate,
}: {
  href: string
  label: string
  Icon: LucideIcon
  pathname: string | null
  enableHomeAnchors: boolean
  activeHomeAnchorId: string | null
  onHomeSectionNavigate: (id: string) => void
}) {
  const rowInner = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate md:block">{label}</span>
    </>
  )

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={itemRowClass(false)}
      >
        {rowInner}
      </a>
    )
  }

  const anchorId = homeSectionAnchorId(href)
  if (anchorId) {
    if (pathname === '/') {
      return (
        <button
          type="button"
          onClick={() => onHomeSectionNavigate(anchorId)}
          className={cn(
            enableHomeAnchors && activeHomeAnchorId === anchorId
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/80',
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
          )}
        >
          {rowInner}
        </button>
      )
    }
    return (
      <Link
        href={`/#${anchorId}`}
        scroll={false}
        className={itemRowClass(false)}
      >
        {rowInner}
      </Link>
    )
  }

  if (href.startsWith('#')) {
    return (
      <Link href={`/${href}`} className={itemRowClass(false)}>
        {rowInner}
      </Link>
    )
  }

  return (
    <Link href={href} className={itemRowClass(routeActive(pathname, href))}>
      {rowInner}
    </Link>
  )
}

function NavNode({
  node,
  pathname,
  enableHomeAnchors,
  activeHomeAnchorId,
  onHomeSectionNavigate,
}: {
  node: NavigationMenuTreeNode
  pathname: string | null
  enableHomeAnchors: boolean
  activeHomeAnchorId: string | null
  onHomeSectionNavigate: (id: string) => void
}) {
  const Icon = navigationIcon(node.icon_name)
  const children = node.children

  if (children.length === 0) {
    return (
      <LeafLink
        href={node.href}
        label={node.label}
        Icon={Icon}
        pathname={pathname}
        enableHomeAnchors={enableHomeAnchors}
        activeHomeAnchorId={activeHomeAnchorId}
        onHomeSectionNavigate={onHomeSectionNavigate}
      />
    )
  }

  return (
    <Collapsible className="space-y-0.5">
      <CollapsibleTrigger
        className={cn(
          itemRowClass(false),
          'w-full text-left [&[data-state=open]>svg:last-child]:rotate-180',
        )}
      >
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <span className="hidden flex-1 md:block">{node.label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-70 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pb-1 pl-2 pt-0.5 data-[state=closed]:animate-none md:ml-3 md:border-l md:border-border md:pl-3">
        {children.map((ch) => {
          const CIcon = navigationIcon(ch.icon_name)
          return (
            <LeafLink
              key={ch.id}
              href={ch.href}
              label={ch.label}
              Icon={CIcon}
              pathname={pathname}
              enableHomeAnchors={enableHomeAnchors}
              activeHomeAnchorId={activeHomeAnchorId}
              onHomeSectionNavigate={onHomeSectionNavigate}
            />
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Sidebar({
  navigation,
  enableHomeAnchors = false,
}: SidebarProps) {
  const pathname = usePathname()
  const [homeAnchor, setHomeAnchor] = useState<string | null>(null)

  useEffect(() => {
    if (pathname !== '/') {
      setHomeAnchor(null)
      return
    }
    const syncFromUrl = () => {
      const h = window.location.hash.replace(/^#/, '')
      setHomeAnchor(h.length > 0 ? h : null)
    }
    syncFromUrl()
    window.addEventListener('hashchange', syncFromUrl)
    window.addEventListener('popstate', syncFromUrl)
    return () => {
      window.removeEventListener('hashchange', syncFromUrl)
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [pathname])

  const onHomeSectionNavigate = useCallback((id: string) => {
    window.history.replaceState(null, '', `/#${id}`)
    setHomeAnchor(id)
    requestAnimationFrame(() => {
      scrollToAnchorId(id)
    })
  }, [])

  const activeHomeAnchorId =
    enableHomeAnchors && pathname === '/' ? homeAnchor : null

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-sidebar md:w-64">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-center border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold text-foreground md:block">
              AI工具集
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navigation.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground md:text-sm">
              侧栏暂无菜单，请管理员在「菜单管理」中配置。
            </p>
          ) : (
            navigation.map((node) => (
              <NavNode
                key={node.id}
                node={node}
                pathname={pathname}
                enableHomeAnchors={enableHomeAnchors}
                activeHomeAnchorId={activeHomeAnchorId}
                onHomeSectionNavigate={onHomeSectionNavigate}
              />
            ))
          )}
        </nav>

        <div className="border-t border-border p-3">
          <Link href="/submit">
            <Button className="w-full justify-center gap-2" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">AI 工具提交</span>
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
