'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CompactAppSidebarFrame } from '@/components/compact-app-sidebar'

interface MobileAccountSheetProps {
  variant?: 'default' | 'admin'
  email: string
  avatarUrl: string | null
}

/**
 * 个人中心 / 管理后台 在 < md 屏宽下的汉堡按钮。
 * 桌面端 (`md:hidden`) 完全不渲染；点击后从左侧滑入与 PC 一致的侧栏内容，
 * 任意菜单项被点击都会自动 `setOpen(false)`，回到内容页。
 */
export function MobileAccountSheet({
  variant = 'default',
  email,
  avatarUrl,
}: MobileAccountSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="打开导航菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[192px] max-w-[85vw] border-r border-border bg-sidebar p-0 sm:max-w-[192px]"
      >
        <SheetTitle className="sr-only">
          {variant === 'admin' ? '管理后台导航' : '个人中心导航'}
        </SheetTitle>
        <CompactAppSidebarFrame
          variant={variant}
          email={email}
          avatarUrl={avatarUrl}
          onItemSelect={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
