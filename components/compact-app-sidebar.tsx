'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Shield,
  ClipboardList,
  Plus,
  History,
  User,
  LayoutGrid,
  Users,
  Upload,
  Boxes,
  Heart,
  Megaphone,
  MessageSquare,
  Tag,
  Tags,
  FolderTree,
  UserSquare,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { AdminRegenerateStaticButton } from '@/components/admin-regenerate-static-button'
import { AdminBulkExtractTagsButton } from '@/components/admin-bulk-extract-tags-button'
import { AccountLogoutButton } from '@/components/account-logout-button'

type Variant = 'default' | 'admin'

interface CompactAppSidebarProps {
  variant?: Variant
  email: string
  avatarUrl: string | null
}

interface CompactAppSidebarFrameProps extends CompactAppSidebarProps {
  /** 移动抽屉传入；点击导航项后关抽屉 */
  onItemSelect?: () => void
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

/**
 * 个人中心 / 管理后台 共用顶部：左侧标识 + 邮箱。
 * - default 变体：头像 + "个人中心"，链接到 /account/profile；
 * - admin   变体：Shield 徽标 + "管理后台"，链接到 /admin（不再额外加底下的徽章）。
 */
function SidebarHeader({
  email,
  avatarUrl,
  isAdmin,
  onItemSelect,
}: {
  email: string
  avatarUrl: string | null
  isAdmin: boolean
  onItemSelect?: () => void
}) {
  const title = isAdmin ? '管理后台' : '个人中心'
  const href = isAdmin ? '/admin' : '/account/profile'

  return (
    <div className="mb-4 border-b border-sidebar-border/60 pb-3">
      <Link
        href={href}
        onClick={onItemSelect}
        className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/60"
      >
        {isAdmin ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
        ) : (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-sidebar-border bg-muted">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        )}
        <span className="font-semibold text-sidebar-foreground">{title}</span>
      </Link>
      <p
        className="mt-2 truncate px-1 text-xs text-muted-foreground"
        title={email}
      >
        {email || '—'}
      </p>
    </div>
  )
}

function NavRow({
  href,
  label,
  Icon,
  active,
  onItemSelect,
  className,
}: {
  href: string
  label: string
  Icon: LucideIcon
  active: boolean
  onItemSelect?: () => void
  /** 子菜单缩进 */
  className?: string
}) {
  return (
    <Link
      href={href}
      onClick={onItemSelect}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

/**
 * 桌面 aside 与移动 Sheet 共用的内容主体。
 *
 * - 顶部统一 "个人中心" 头部（管理员另加 "管理后台" 徽章）；
 * - 个人变体：返回首页 / AI 工具提交 / 工具提交历史 / 我的收藏 / 个人信息；
 *   注意「审核中的工具 / 审核列表」属于管理员审核队列，已从此处移除；用户要看自己的待审，
 *   走 "工具提交历史"（含全部状态）。
 * - 管理变体：在以上基础上再追加管理菜单 + 发布与维护卡片。
 */
export function CompactAppSidebarFrame({
  variant = 'default',
  email,
  avatarUrl,
  onItemSelect,
}: CompactAppSidebarFrameProps) {
  const pathname = usePathname()
  const isAdmin = variant === 'admin'

  const homeActive = pathname === '/'

  const personalLinks = [
    { href: '/submit', label: 'AI 工具提交', icon: Plus },
    { href: '/account/history', label: '工具提交历史', icon: History },
    { href: '/favorites', label: '我的收藏', icon: Heart },
    { href: '/account/profile', label: '个人信息', icon: User },
  ] as const

  const navigationAdminActive = pathname.startsWith('/admin/navigation')
  const tagSceneAdminActive = pathname.startsWith('/admin/tag-categories')
  const tagsListAdminActive = pathname.startsWith('/admin/tags')
  const tagRoleAdminActive = pathname.startsWith('/admin/role-categories')
  const menuCategoriesAdminActive = pathname.startsWith(
    '/admin/menu-categories',
  )
  const tagAdminSubtreeActive =
    tagsListAdminActive ||
    tagSceneAdminActive ||
    tagRoleAdminActive
  const usersAdminActive = pathname.startsWith('/admin/users')
  const importAdminActive = pathname.startsWith('/admin/import-tools')
  const toolsStatsAdminActive = pathname.startsWith('/admin/stats')
  const toolsTaggingAdminActive = pathname.startsWith(
    '/admin/tools-tagging',
  )
  const adsAdminActive = pathname.startsWith('/admin/ads')
  const commentsAdminActive = pathname.startsWith('/admin/comments')
  const reviewsAdminActive =
    pathname.startsWith('/admin') &&
    !commentsAdminActive &&
    !tagAdminSubtreeActive &&
    !navigationAdminActive &&
    !menuCategoriesAdminActive &&
    !usersAdminActive &&
    !importAdminActive &&
    !toolsStatsAdminActive &&
    !toolsTaggingAdminActive &&
    !adsAdminActive

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <SidebarHeader
        email={email}
        avatarUrl={avatarUrl}
        isAdmin={isAdmin}
        onItemSelect={onItemSelect}
      />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <NavRow
          href="/"
          label="返回首页"
          Icon={Home}
          active={homeActive}
          onItemSelect={onItemSelect}
        />

        {!isAdmin && (
          <>
            <p className="mb-1 mt-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              个人相关
            </p>
            {personalLinks.map(({ href, label, icon: Icon }) => (
              <NavRow
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isPersonalAreaActive(pathname, href)}
                onItemSelect={onItemSelect}
              />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="my-1 h-px w-full shrink-0 bg-border" role="presentation" />

            <NavRow
              href="/admin"
              label="审核列表"
              Icon={ClipboardList}
              active={reviewsAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/stats"
              label="工具管理"
              Icon={Boxes}
              active={toolsStatsAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/tools-tagging"
              label="工具与标签"
              Icon={Tags}
              active={toolsTaggingAdminActive}
              onItemSelect={onItemSelect}
              className="pl-8 opacity-[0.92]"
            />
            <NavRow
              href="/admin/import-tools"
              label="批量导入"
              Icon={Upload}
              active={importAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/ads"
              label="广告位管理"
              Icon={Megaphone}
              active={adsAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/comments"
              label="评论管理"
              Icon={MessageSquare}
              active={commentsAdminActive}
              onItemSelect={onItemSelect}
            />

            <div className="my-1 h-px w-full shrink-0 bg-border" role="presentation" />

            <NavRow
              href="/admin/tags"
              label="标签管理"
              Icon={Tag}
              active={tagsListAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/tag-categories"
              label="场景分类管理"
              Icon={FolderTree}
              active={tagSceneAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/role-categories"
              label="角色分类管理"
              Icon={UserSquare}
              active={tagRoleAdminActive}
              onItemSelect={onItemSelect}
            />

            <div className="my-1 h-px w-full shrink-0 bg-border" role="presentation" />

            <NavRow
              href="/admin/navigation"
              label="菜单管理"
              Icon={LayoutGrid}
              active={navigationAdminActive}
              onItemSelect={onItemSelect}
            />
            <NavRow
              href="/admin/menu-categories"
              label="菜单分类管理"
              Icon={Layers}
              active={menuCategoriesAdminActive}
              onItemSelect={onItemSelect}
              className="pl-8 opacity-[0.92]"
            />
            <NavRow
              href="/admin/users"
              label="用户管理"
              Icon={Users}
              active={usersAdminActive}
              onItemSelect={onItemSelect}
            />

            <div className="mt-1.5 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-2">
              <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                发布与维护
              </p>
              <div className="flex flex-col gap-1.5">
                <AdminRegenerateStaticButton className="w-full justify-start" />
                <AdminBulkExtractTagsButton className="w-full justify-start" />
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border/60 pt-3">
        <AccountLogoutButton />
      </div>
    </div>
  )
}

/**
 * 桌面侧栏（≥ md 才展示）。移动端通过 `<MobileAccountSheet>` 抽屉访问，避免占用屏宽。
 */
export function CompactAppSidebar(props: CompactAppSidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen w-52 flex-col border-r border-border bg-sidebar md:flex md:w-56',
      )}
    >
      <CompactAppSidebarFrame {...props} />
    </aside>
  )
}
