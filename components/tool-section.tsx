'use client'

import { useState } from 'react'
import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { HomeListedTool } from '@/lib/types'
import { accountPortalToolPath } from '@/lib/account-portal-path'
import { ChevronDown, Clock, Flame } from 'lucide-react'

interface ToolSectionProps {
  title: string
  tools: HomeListedTool[]
  icon?: 'hot' | 'new'
  /** 首页锚点 id，用于侧边栏平滑滚动定位 */
  anchorId?: string
  /** 前 N 张列表图使用 loading=priority，改善首屏；其余惰性解码 */
  imagePriorityFirstN?: number
  /**
   * 移动端首屏默认显示的卡片数；超过则显示「展开更多」按钮，避免首页一次渲染
   * 几百张 ToolCard 把弱机型 CPU 拖死。桌面（≥ md）通过 CSS 不受此限制。
   */
  mobileInitialCount?: number
  /**
   * 卡片详情链接策略（勿传函数：Server → Client 不可序列化）。
   * `portal`：站内 `/account/home/tool/...`，当前标签打开。
   */
  toolCardLinkMode?: 'public' | 'portal'
}

export function ToolSection({
  title,
  tools,
  icon,
  anchorId,
  imagePriorityFirstN = 0,
  mobileInitialCount = 8,
  toolCardLinkMode = 'public',
}: ToolSectionProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  if (tools.length === 0 && (icon === 'hot' || icon === 'new')) {
    return null
  }

  const hasMobileOverflow =
    !mobileExpanded && tools.length > mobileInitialCount

  return (
    <section
      id={anchorId}
      className="scroll-mt-24 space-y-4"
      aria-labelledby={anchorId ? `${anchorId}-heading` : undefined}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="gap-1 px-3 py-1"
          id={anchorId ? `${anchorId}-heading` : undefined}
        >
          {icon === 'hot' && (
            <Flame className="h-3.5 w-3.5 text-orange-500" />
          )}
          {icon === 'new' && (
            <Clock className="h-3.5 w-3.5 text-blue-500" />
          )}
          <span className="font-medium">{title}</span>
        </Badge>
        {hasMobileOverflow ? (
          <span className="text-xs text-muted-foreground md:hidden">
            共 {tools.length} 个
          </span>
        ) : null}
      </div>
      {tools.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          暂无已通过审核的工具收录，可先
          <a href="/submit" className="underline underline-offset-2">
            提交工具
          </a>
          。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
            {tools.map((tool, idx) => {
              const overflow = idx >= mobileInitialCount && !mobileExpanded
              return (
                <div
                  key={tool.id}
                  className={overflow ? 'hidden md:block' : undefined}
                >
                  <ToolCard
                    tool={tool}
                    imagePriority={idx < imagePriorityFirstN}
                    fluid
                    detailHrefOverride={
                      toolCardLinkMode === 'portal'
                        ? accountPortalToolPath(tool.slug)
                        : undefined
                    }
                    openInNewTab={toolCardLinkMode !== 'portal'}
                  />
                </div>
              )
            })}
          </div>

          {hasMobileOverflow ? (
            <div className="md:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setMobileExpanded(true)}
              >
                展开剩余 {tools.length - mobileInitialCount} 个
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
