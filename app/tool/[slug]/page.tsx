'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { FavoriteButton } from '@/components/favorite-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ToolDetailView,
} from '@/components/tool-detail-view'
import { toolDetailPageGutterClass, toolDetailMaxWidthClass } from '@/lib/tool-detail-layout'
import { ArrowLeft, Eye, Heart, ExternalLink } from 'lucide-react'
import type {
  NavigationMenuItemRow,
  NavigationMenuTreeNode,
  Tool,
  Profile,
} from '@/lib/types'
import { buildNavigationTree } from '@/lib/navigation-tree'
import { toolPublicPath } from '@/lib/tool-public-path'
import { FrontendLoadingHint } from '@/components/frontend-loading-hint'
import type { User } from '@supabase/supabase-js'

export default function ToolPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = decodeURIComponent(String(params.slug ?? '')).trim()
  const hideCommentsForAdminPreview =
    searchParams.get('admin_preview') === '1'

  const [tool, setTool] = useState<Tool | null>(null)
  const [navigation, setNavigation] = useState<NavigationMenuTreeNode[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single()
        setProfile(profileData)
      }

      const { data: navData } = await supabase
        .from('navigation_menu_items')
        .select('id,parent_id,label,href,icon_name,sort_order,is_visible')
        .eq('is_visible', true)
        .order('sort_order')

      setNavigation(
        navData?.length
          ? buildNavigationTree(navData as NavigationMenuItemRow[])
          : [],
      )

      const publicRes = await fetch(
        `/api/public/tools/${encodeURIComponent(slug)}`,
        { cache: 'no-store' },
      )

      if (publicRes.ok) {
        const toolData = (await publicRes.json()) as Tool
        setTool(toolData)

        if (currentUser) {
          const { data: favorite } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('tool_id', toolData.id)
            .maybeSingle()
          setIsFavorited(!!favorite)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [slug])

  /** 卡片点击与详情首屏 GET 并发时，访问数可能尚未 +1；稍后再拉一次仅同步 view_count */
  useEffect(() => {
    if (!slug || !tool?.id) return
    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/tools/${encodeURIComponent(slug)}`,
          { cache: 'no-store', signal: ac.signal },
        )
        if (!res.ok) return
        const fresh = (await res.json()) as Tool
        setTool((prev) =>
          prev?.id === fresh.id
            ? { ...prev, view_count: fresh.view_count }
            : prev,
        )
      } catch {
        /* aborted */
      }
    }, 450)
    return () => {
      ac.abort()
      window.clearTimeout(t)
    }
  }, [slug, tool?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar navigation={navigation} enableHomeAnchors={false} />
        <div className="pl-16 md:pl-64">
          <Header user={user} profile={profile} />
          <main className="flex min-h-[50vh] items-center justify-center p-6">
            <FrontendLoadingHint />
          </main>
        </div>
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar navigation={navigation} enableHomeAnchors={false} />
        <div className="pl-16 md:pl-64">
          <Header user={user} profile={profile} />
          <main className={toolDetailPageGutterClass}>
            <div className={`${toolDetailMaxWidthClass} text-center`}>
              <h1 className="text-2xl font-bold text-foreground">工具未找到</h1>
              <p className="mt-2 text-muted-foreground">该工具可能已被移除或不存在</p>
              <Link href="/" className="mt-4 inline-block text-primary hover:underline">
                返回首页
              </Link>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} enableHomeAnchors={false} />

      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />

        <main className={toolDetailPageGutterClass}>
          <div className={toolDetailMaxWidthClass}>
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>

            <ToolDetailView
              tool={tool}
              logoHref={toolPublicPath(tool.slug)}
              showComments={!hideCommentsForAdminPreview}
              badges={
                <>
                  {tool.category ? (
                    <Link href={`/category/${tool.category.slug}`}>
                      <Badge variant="secondary">{tool.category.name}</Badge>
                    </Link>
                  ) : null}
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    {tool.view_count ?? 0} 次访问
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Heart
                      className="h-4 w-4 shrink-0 text-red-500/70"
                      aria-hidden
                    />
                    {(tool.favorite_count ?? 0).toLocaleString()} 收藏
                  </span>
                </>
              }
              headerActions={
                <>
                  <FavoriteButton
                    toolId={tool.id}
                    initialFavorited={isFavorited}
                    isLoggedIn={!!user}
                    onFavoriteCountDelta={(delta) => {
                      setTool((prev) =>
                        prev
                          ? {
                              ...prev,
                              favorite_count: Math.max(
                                0,
                                (prev.favorite_count ?? 0) + delta,
                              ),
                            }
                          : prev,
                      )
                    }}
                  />
                  <Button asChild>
                    <a
                      href={tool.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      访问网站
                    </a>
                  </Button>
                </>
              }
              commentsInitialUser={user}
              commentsInitialNickname={profile?.display_name ?? null}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
