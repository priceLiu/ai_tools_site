'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ExternalLink, Sparkles, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToolIntroductionDisplay } from '@/components/tool-introduction-display'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'
import { ToolCommentsSection } from '@/components/tool-comments-section'
import { cn } from '@/lib/utils'
import type { Tool } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export {
  toolDetailPageGutterClass,
  toolDetailMaxWidthClass,
} from '@/lib/tool-detail-layout'

interface ToolDetailViewProps {
  tool: Tool
  /** 工具头像外层链接；传 null/false 则不包裹链接 */
  logoHref?: string | null | false
  /** 标题下方一行：分类、状态、数据等 */
  badges?: ReactNode
  /** 右上角：收藏、访问网站等 */
  headerActions?: ReactNode
  /** 第一版面底部扩展（如拒绝原因） */
  panelFooter?: ReactNode
  /** 第二版面：无正文时是否仍展示卡片 */
  alwaysShowIntroductionCard?: boolean
  showComments?: boolean
  commentsInitialUser?: User | null
  commentsInitialNickname?: string | null
  /** 主内容后（如管理端编辑表单） */
  children?: ReactNode
  className?: string
}

export function ToolDetailView({
  tool,
  logoHref,
  badges,
  headerActions,
  panelFooter,
  alwaysShowIntroductionCard = true,
  showComments = true,
  commentsInitialUser = null,
  commentsInitialNickname = null,
  children,
  className,
}: ToolDetailViewProps) {
  const desc = (tool.description ?? '').trim()
  const intro = tool.introduction?.trim() ?? ''
  const showIntroCard = alwaysShowIntroductionCard || Boolean(intro)

  const logoBox = (
    <>
      {tool.logo_url ? (
        <Image
          src={tool.logo_url}
          alt={tool.name}
          fill
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
      )}
    </>
  )

  const logoClass =
    'relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted outline-none ring-offset-background'

  const logoEl =
    logoHref && logoHref !== false ? (
      <Link
        href={logoHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          logoClass,
          'block hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label={`在新标签打开${tool.name}`}
      >
        {logoBox}
      </Link>
    ) : (
      <div className={logoClass}>{logoBox}</div>
    )

  return (
    <div className={cn('w-full', className)}>
      {/* 第一版面：头图行 + 概述（5 行）+ 截图 */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-row flex-wrap items-end gap-x-4 gap-y-3 sm:flex-nowrap">
            {logoEl}
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-2xl font-bold leading-tight text-foreground">
                {tool.name}
              </h1>
              {badges ? (
                <div className="flex flex-wrap items-center gap-2">{badges}</div>
              ) : null}
            </div>
            {headerActions ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pb-0">
                {headerActions}
              </div>
            ) : null}
          </div>

          {desc ? (
            <p
              className="mt-6 break-words text-muted-foreground leading-relaxed line-clamp-5"
              title={desc}
            >
              {desc}
            </p>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">暂无概述</p>
          )}

          {tool.screenshot_url ? (
            <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border bg-muted">
              <Image
                src={tool.screenshot_url}
                alt={`${tool.name} 截图`}
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="mt-4">
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{tool.website_url}</span>
            </a>
          </div>

          {panelFooter ? <div className="mt-4">{panelFooter}</div> : null}
        </CardContent>
      </Card>

      {/* 第二版面：工具介绍 */}
      {showIntroCard ? (
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              工具介绍
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-6 sm:px-6 md:px-8">
            {intro ? (
              <ToolIntroductionDisplay
                content={tool.introduction!}
                format={normalizeIntroductionFormat(tool.introduction_format)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">暂无工具介绍</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* 第三版面：评论 */}
      {showComments ? (
        <ToolCommentsSection
          toolId={tool.id}
          initialUser={commentsInitialUser}
          initialNickname={commentsInitialNickname}
        />
      ) : null}

      {children}
    </div>
  )
}
