'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ExternalLink, Sparkles, BookOpen, FolderTree } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ToolIntroductionDisplay } from '@/components/tool-introduction-display'
import { ToolTagsBar } from '@/components/tool-tags-bar'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'
import { ToolCommentsSection } from '@/components/tool-comments-section'
import { cn } from '@/lib/utils'
import { toolTagLabelsFromTool } from '@/lib/tool-tags-extract'
import type { Tool } from '@/lib/types'
import { trimOrNull, trimOrNullImageSrc } from '@/lib/trim-or-null'
import type { AuthUser } from '@/lib/auth/session'
import { tagCategoryPublicPath } from '@/lib/tag-slug'

export {
  toolDetailPageGutterClass,
  toolDetailMaxWidthClass,
} from '@/lib/tool-detail-layout'

interface ToolDetailViewProps {
  tool: Tool
  /** 由挂载标签推导的场景分类（与首页「按场景」一致） */
  sceneSummaries?: { name: string; slug: string }[]
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
  commentsInitialUser?: AuthUser | null
  commentsInitialNickname?: string | null
  /** 主内容后（如管理端编辑表单） */
  children?: ReactNode
  className?: string
}

export function ToolDetailView({
  tool,
  sceneSummaries,
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
  const detailTags = toolTagLabelsFromTool(tool)
  const websiteUrl = trimOrNull(tool.website_url)
  const screenshotSrc = trimOrNullImageSrc(tool.screenshot_url)

  const logoSrc = trimOrNullImageSrc(tool.logo_url)
  const [logoFailed, setLogoFailed] = useState(false)
  const [screenshotFailed, setScreenshotFailed] = useState(false)
  useEffect(() => {
    setLogoFailed(false)
    setScreenshotFailed(false)
  }, [tool.id, logoSrc, screenshotSrc])

  const logoBox = (
    <>
      {logoSrc && !logoFailed ? (
        <Image
          src={logoSrc}
          alt={tool.name}
          fill
          className="object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
          <Sparkles className="h-8 w-8 text-primary md:h-12 md:w-12" />
        </div>
      )}
    </>
  )

  const logoClass =
    'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted outline-none ring-offset-background sm:h-20 sm:w-20 sm:rounded-2xl md:h-24 md:w-24'

  const logoEl =
    typeof logoHref === 'string' && logoHref.length > 0 ? (
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
      <Card className="mb-4 overflow-hidden md:mb-6">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex items-start gap-3 sm:items-end sm:gap-4">
            {logoEl}
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <h1 className="text-lg font-bold leading-tight text-foreground sm:text-xl md:text-2xl">
                {tool.name}
              </h1>
              {badges ? (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {badges}
                </div>
              ) : null}
            </div>
          </div>

          {headerActions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
              {headerActions}
            </div>
          ) : null}

          {desc ? (
            <p
              className="mt-4 break-words text-sm text-muted-foreground leading-relaxed line-clamp-5 md:mt-6 md:text-base"
              title={desc}
            >
              {desc}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground md:mt-6">暂无概述</p>
          )}

          {screenshotSrc && !screenshotFailed ? (
            <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border bg-muted">
              {screenshotSrc.startsWith('data:') ? (
                // next/image 对超大 data URL 偶发异常，截图多为 base64，直接用 img 更稳
                <img
                  src={screenshotSrc}
                  alt={`${tool.name} 截图`}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() => setScreenshotFailed(true)}
                />
              ) : (
                <Image
                  src={screenshotSrc}
                  alt={`${tool.name} 截图`}
                  fill
                  className="object-cover"
                  onError={() => setScreenshotFailed(true)}
                />
              )}
            </div>
          ) : null}

          {websiteUrl ? (
            <div className="mt-4">
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{websiteUrl}</span>
              </a>
            </div>
          ) : null}

          {panelFooter ? <div className="mt-4">{panelFooter}</div> : null}
        </CardContent>
      </Card>

      {sceneSummaries && sceneSummaries.length > 0 ? (
        <section
          className="mb-4 rounded-xl border border-border bg-gradient-to-br from-muted/40 via-card to-muted/25 px-4 py-3.5 shadow-sm md:mb-6"
          aria-label="所属场景"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FolderTree className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
            <span>场景分类</span>
            <span className="font-normal text-[11px] text-muted-foreground/90">
              （首页「按场景找 AI」聚合口径）
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sceneSummaries.map((s) => (
              <Link
                key={s.slug}
                href={tagCategoryPublicPath(s.slug)}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className="border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
                >
                  {s.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {detailTags.length > 0 ? (
        <ToolTagsBar labels={detailTags} className="mb-4 md:mb-6" />
      ) : null}

      {/* 第二版面：工具介绍 */}
      {showIntroCard ? (
        <Card className="mb-4 overflow-hidden md:mb-6">
          <CardHeader className="border-b px-4 py-3 sm:px-6 md:py-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              工具介绍
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pt-4 sm:px-6 md:px-8 md:pt-6">
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

      {/* 第三版面：评论 — 进入视口才挂载，移动端首屏减压 */}
      {showComments ? (
        <DeferredComments
          toolId={tool.id}
          initialUser={commentsInitialUser}
          initialNickname={commentsInitialNickname}
        />
      ) : null}

      {children}
    </div>
  )
}

/**
 * 评论组件较重（含登录态、评论列表、表单等）；用 IntersectionObserver 把它推迟到
 * 用户滚动到附近再挂载，移动端首屏 hydration 时间显著下降。
 */
function DeferredComments({
  toolId,
  initialUser,
  initialNickname,
}: {
  toolId: string
  initialUser: AuthUser | null
  initialNickname: string | null
}) {
  const [show, setShow] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (show) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return
    }
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          ob.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [show])

  if (show) {
    return (
      <ToolCommentsSection
        toolId={toolId}
        initialUser={initialUser}
        initialNickname={initialNickname}
      />
    )
  }
  return (
    <div
      ref={sentinelRef}
      className="min-h-[120px] rounded-xl border border-dashed border-border/60 bg-muted/20"
      aria-hidden
    />
  )
}
