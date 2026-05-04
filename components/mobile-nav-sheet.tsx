'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarFrame } from '@/components/sidebar'
import type { NavigationMenuTreeNode } from '@/lib/types'

interface MobileNavSheetProps {
  navigation: NavigationMenuTreeNode[]
  enableHomeAnchors?: boolean
}

/**
 * 移动端 header 左上角的汉堡按钮，打开后从左滑入完整侧栏内容。
 * - 桌面（≥ md）通过 `md:hidden` 隐藏，桌面用 `<Sidebar>` 永久展示。
 * - 抽屉里的导航点击后自动 `setOpen(false)` 关闭。
 */
export function MobileNavSheet({
  navigation,
  enableHomeAnchors = false,
}: MobileNavSheetProps) {
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
        className="w-[18rem] max-w-[85vw] border-r border-border bg-sidebar p-0 sm:max-w-[18rem]"
      >
        <SheetTitle className="sr-only">导航菜单</SheetTitle>
        <SidebarFrame
          navigation={navigation}
          enableHomeAnchors={enableHomeAnchors}
          onItemSelect={() => setOpen(false)}
          alwaysExpanded
        />
      </SheetContent>
    </Sheet>
  )
}
