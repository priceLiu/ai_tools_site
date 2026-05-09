'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { NavigationMenuTreeNode } from '@/lib/types'
import { slugFromCategoryMenuHref } from '@/lib/submit-category-choices'
import { navigationIcon } from '@/lib/navigation-icons'
import { Award, ChevronDown, Plus, Sparkles, type LucideIcon } from 'lucide-react'
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

/** 父级无直接锚点时，按 sort_order 取第一个可解析为首页区块的子项锚点 */
function firstChildHomeSectionAnchorId(
  children: NavigationMenuTreeNode[],
): string | null {
  const sorted = [...children].sort((a, b) => a.sort_order - b.sort_order)
  for (const ch of sorted) {
    const id = homeSectionAnchorId(ch.href)
    if (id) return id
  }
  return null
}

interface SidebarProps {
  navigation: NavigationMenuTreeNode[]
  enableHomeAnchors?: boolean
}

interface SidebarFrameProps extends SidebarProps {
  /** 移动抽屉中传入；点击导航项后自动关抽屉 */
  onItemSelect?: () => void
  /**
   * 抽屉里恒为 true（始终铺开 ~162px、显示 logo 文字 + 节点标签）；
   * 桌面 aside 下保持 false：md 断点以上才显示文字。
   */
  alwaysExpanded?: boolean
}

function itemRowClass(active: boolean) {
  return cn(
    'flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
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
  onItemSelect,
  showLabel,
}: {
  href: string
  label: string
  Icon: LucideIcon
  pathname: string | null
  enableHomeAnchors: boolean
  activeHomeAnchorId: string | null
  onHomeSectionNavigate: (id: string) => void
  /** 在抽屉等需要点击后关闭的容器中传入 */
  onItemSelect?: () => void
  /** 抽屉里强制显示文字；桌面 collapsed 64px 不显示 */
  showLabel: boolean
}) {
  const labelClass = showLabel
    ? 'min-w-0 flex-1 truncate'
    : 'hidden min-w-0 flex-1 truncate md:block'
  const rowInner = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className={labelClass}>{label}</span>
    </>
  )

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={itemRowClass(false)}
        onClick={onItemSelect}
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
          onClick={() => {
            onHomeSectionNavigate(anchorId)
            onItemSelect?.()
          }}
          className={cn(
            enableHomeAnchors && activeHomeAnchorId === anchorId
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/80',
            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors',
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
        onClick={onItemSelect}
      >
        {rowInner}
      </Link>
    )
  }

  if (href.startsWith('#')) {
    return (
      <Link
        href={`/${href}`}
        className={itemRowClass(false)}
        onClick={onItemSelect}
      >
        {rowInner}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={itemRowClass(routeActive(pathname, href))}
      onClick={onItemSelect}
    >
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
  onItemSelect,
  showLabel,
}: {
  node: NavigationMenuTreeNode
  pathname: string | null
  enableHomeAnchors: boolean
  activeHomeAnchorId: string | null
  onHomeSectionNavigate: (id: string) => void
  onItemSelect?: () => void
  showLabel: boolean
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
        onItemSelect={onItemSelect}
        showLabel={showLabel}
      />
    )
  }

  const parentSectionId =
    enableHomeAnchors && pathname === '/'
      ? homeSectionAnchorId(node.href) ??
        firstChildHomeSectionAnchorId(children)
      : null

  const parentLabelClass = showLabel ? 'flex-1' : 'hidden flex-1 md:block'
  const groupChildClass = showLabel
    ? 'space-y-0.5 pb-1 pl-1 pt-0.5 data-[state=closed]:animate-none ml-2 border-l border-border pl-2'
    : 'space-y-0.5 pb-1 pl-1 pt-0.5 data-[state=closed]:animate-none md:ml-2 md:border-l md:border-border md:pl-2'

  return (
    <Collapsible className="space-y-0.5">
      <CollapsibleTrigger
        className={cn(
          itemRowClass(false),
          'w-full text-left [&[data-state=open]>svg:last-child]:rotate-180',
        )}
        onClick={() => {
          if (parentSectionId) onHomeSectionNavigate(parentSectionId)
        }}
      >
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <span className={parentLabelClass}>{node.label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-70 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className={groupChildClass}>
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
              onItemSelect={onItemSelect}
              showLabel={showLabel}
            />
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * 共享内容：logo 头 / 导航树 / 提交按钮。
 * 桌面 `<Sidebar>` 与移动 `<MobileNavSheet>` 都使用它，避免重复代码。
 */
export function SidebarFrame({
  navigation,
  enableHomeAnchors = false,
  onItemSelect,
  alwaysExpanded = false,
}: SidebarFrameProps) {
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

  const logoTextClass = alwaysExpanded
    ? 'text-lg font-bold text-foreground'
    : 'hidden text-lg font-bold text-foreground md:block'
  const submitTextClass = alwaysExpanded ? 'inline' : 'hidden md:inline'
  const emptyHintClass = alwaysExpanded
    ? 'px-2 py-4 text-sm text-muted-foreground'
    : 'px-2 py-4 text-xs text-muted-foreground md:text-sm'

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-center border-b border-border px-3">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={onItemSelect}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className={logoTextClass}>AI工具集</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navigation.length === 0 ? (
          <p className={emptyHintClass}>
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
              onItemSelect={onItemSelect}
              showLabel={alwaysExpanded}
            />
          ))
        )}
      </nav>

      <div className="space-y-2 border-t border-border p-2">
        <Link href="/excellent-ai-solutions" onClick={onItemSelect}>
          <Button
            variant={
              pathname?.startsWith('/excellent-ai-solutions')
                ? 'secondary'
                : 'outline'
            }
            className="w-full justify-center gap-2"
            size="sm"
          >
            <Award className="h-4 w-4 shrink-0" />
            <span className={submitTextClass}>方案集</span>
          </Button>
        </Link>
        <Link href="/submit" onClick={onItemSelect}>
          <Button className="w-full justify-center gap-2" size="sm">
            <Plus className="h-4 w-4" />
            <span className={submitTextClass}>AI 工具提交</span>
          </Button>
        </Link>
      </div>
    </div>
  )
}

/**
 * 桌面侧栏（≥ md 始终可见）。移动端通过 `<MobileNavSheet>` 抽屉访问，避免占用屏宽。
 */
export function Sidebar(props: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[162px] border-r border-border bg-sidebar md:block">
      <SidebarFrame {...props} />
    </aside>
  )
}
