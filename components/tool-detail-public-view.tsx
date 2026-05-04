'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Eye, Heart } from 'lucide-react'
import { FavoriteButton } from '@/components/favorite-button'
import { ToolDetailView } from '@/components/tool-detail-view'
import { trimOrNull } from '@/lib/trim-or-null'
import { recordToolViewBySlug } from '@/lib/client-record-tool-view'
import { toolPublicPath } from '@/lib/tool-public-path'
import type { AuthUser } from '@/lib/auth/session'
import type { Profile, Tool } from '@/lib/types'

interface ToolDetailPublicViewProps {
  tool: Tool
  hideComments?: boolean
}

/**
 * 详情页客户端动态岛：
 * - 服务端已 SSR 渲染工具静态信息（描述、截图、介绍等）。
 * - 这里在客户端拉 session + 收藏状态，挂载时上报一次访问量。
 * - 与服务端渲染共用 `<ToolDetailView>`，只多接管收藏/访问数与登录态。
 */
export function ToolDetailPublicView({
  tool,
  hideComments,
}: ToolDetailPublicViewProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favCount, setFavCount] = useState<number>(tool.favorite_count ?? 0)
  const [viewCount, setViewCount] = useState<number>(tool.view_count ?? 0)

  /** 仅本地 +1 显示，真实自增由 `/api/public/tools/:slug/view` 处理 */
  useEffect(() => {
    if (!tool.slug) return
    recordToolViewBySlug(tool.slug)
    setViewCount((v) => v + 1)
  }, [tool.slug])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!r.ok) return
        const j = (await r.json()) as { user: AuthUser | null }
        if (cancelled) return
        setUser(j.user ?? null)
        if (!j.user) return

        const [favRes, profRes] = await Promise.all([
          fetch(
            `/api/account/favorite-status?toolId=${encodeURIComponent(tool.id)}`,
            { cache: 'no-store' },
          ),
          fetch('/api/account/profile', { cache: 'no-store' }),
        ])
        if (cancelled) return
        if (favRes.ok) {
          const favJson = (await favRes.json()) as { favorited?: boolean }
          setIsFavorited(Boolean(favJson.favorited))
        }
        if (profRes.ok) {
          const p = (await profRes.json()) as Profile | null
          setProfile(p)
        }
      } catch {
        /* 静默：游客视图仍可用 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tool.id])

  const websiteUrl = trimOrNull(tool.website_url)

  return (
    <ToolDetailView
      tool={{
        ...tool,
        view_count: viewCount,
        favorite_count: favCount,
      }}
      logoHref={toolPublicPath(tool.slug)}
      showComments={!hideComments}
      badges={
        <>
          {tool.category ? (
            <Link href={`/category/${tool.category.slug}`}>
              <Badge variant="secondary">{tool.category.name}</Badge>
            </Link>
          ) : null}
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            {viewCount.toLocaleString()} 次访问
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Heart
              className="h-4 w-4 shrink-0 text-red-500/70"
              aria-hidden
            />
            {favCount.toLocaleString()} 收藏
          </span>
        </>
      }
      headerActions={
        <>
          <FavoriteButton
            toolId={tool.id}
            initialFavorited={isFavorited}
            isLoggedIn={!!user}
            onFavoriteCountDelta={(delta) =>
              setFavCount((n) => Math.max(0, n + delta))
            }
          />
          {websiteUrl ? (
            <Button asChild>
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                访问网站
              </a>
            </Button>
          ) : null}
        </>
      }
      commentsInitialUser={user}
      commentsInitialNickname={profile?.display_name ?? null}
    />
  )
}
