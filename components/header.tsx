'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { HeaderSearchForm } from '@/components/header-search-form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  User,
  LogOut,
  Settings,
  Heart,
  MoreVertical,
  History,
  Sparkles,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth/session'
import type { Profile } from '@/lib/types'
import { invalidateAuthMeCache } from '@/lib/client-auth-me-cache'
import { excellentSolutionsListPath } from '@/lib/account-portal-path'

interface HeaderProps {
  user: AuthUser | null
  profile: Profile | null
  /** 移动端左上角汉堡按钮槽位；通常传入 `<MobileNavSheet>` */
  mobileNav?: ReactNode
}

export function Header({ user, profile, mobileNav }: HeaderProps) {
  const handleLogout = () => {
    void (async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      invalidateAuthMeCache()
      window.location.assign('/')
    })()
  }

  return (
    <header className="flex h-14 items-center justify-between gap-3 px-3 md:h-16 md:gap-4 md:px-6">
      {/**
       * PC（md+）布局严格对齐原版：h-16 / gap-4 / px-6 / justify-between；
       * 仅在 < md 用紧凑尺寸 + 渲染 mobileNav 槽位，不影响桌面端。
       * 粘性顶栏与底边线由外层 `SitePublicHeader` / `AccountChrome` 统一包住。
       */}
      {mobileNav}
      <HeaderSearchForm />
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1.5 px-2 text-primary md:px-3"
      >
        <Link
          href={excellentSolutionsListPath()}
          title="AI 方案集"
          className="flex items-center"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden font-medium sm:inline">方案集</span>
        </Link>
      </Button>

      {/* Actions */}
      <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/submit">
                  <Plus className="mr-1 h-4 w-4" />
                  <span>AI 工具提交</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link href="/account" aria-label="个人中心" title="个人中心">
                  <User className="h-5 w-5" />
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="更多"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-medium">
                    {profile?.display_name || user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favorites" className="cursor-pointer">
                      <Heart className="mr-2 h-4 w-4" />
                      我的收藏
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={excellentSolutionsListPath()}
                      className="cursor-pointer"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI 方案集
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/history" className="cursor-pointer">
                      <History className="mr-2 h-4 w-4" />
                      工具提交历史
                    </Link>
                  </DropdownMenuItem>
                  {profile?.is_admin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          管理后台
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive"
                    onSelect={() => {
                      handleLogout()
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">登录</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/sign-up">注册</Link>
              </Button>
            </>
          )}
        </div>
    </header>
  )
}
