'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { FavoriteButton } from '@/components/favorite-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ExternalLink,
  ArrowLeft,
  Eye,
  Heart,
  Sparkles,
  BookOpen,
  Lightbulb,
} from 'lucide-react'
import { ToolCommentsSection } from '@/components/tool-comments-section'
import type { Category, Tool, Profile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export default function ToolPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchData() {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      // Get profile if logged in
      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single()
        setProfile(profileData)
      }
      
      // Get categories for sidebar
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
      setCategories(categoriesData || [])
      
      // Get tool
      const { data: toolData } = await supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('slug', slug)
        .eq('status', 'approved')
        .single()
      
      if (toolData) {
        const nextViews = Number(toolData.view_count ?? 0) + 1
        await supabase
          .from('tools')
          .update({ view_count: nextViews })
          .eq('id', toolData.id)

        setTool({
          ...(toolData as Tool),
          view_count: nextViews,
        })

        // Check if favorited
        if (currentUser) {
          const { data: favorite } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('tool_id', toolData.id)
            .single()
          setIsFavorited(!!favorite)
        }
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [slug, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar categories={[]} />
        <div className="pl-16 md:pl-64">
          <Header user={null} profile={null} />
          <main className="flex items-center justify-center p-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </main>
        </div>
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar categories={categories} />
        <div className="pl-16 md:pl-64">
          <Header user={user} profile={profile} />
          <main className="p-4 md:p-6">
            <div className="mx-auto max-w-4xl text-center">
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
      <Sidebar categories={categories} />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />
        
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            {/* Back Link */}
            <Link 
              href="/"
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            
            {/* Tool Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  {/* Logo */}
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
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
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-foreground">{tool.name}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {tool.category && (
                            <Link href={`/category/${tool.category.slug}`}>
                              <Badge variant="secondary">{tool.category.name}</Badge>
                            </Link>
                          )}
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
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                          <a href={tool.website_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            访问网站
                          </a>
                        </Button>
                      </div>
                    </div>
                    
                    <p className="mt-4 text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Screenshot */}
            {tool.screenshot_url && (
              <Card className="mb-6 overflow-hidden">
                <div className="relative aspect-video">
                  <Image
                    src={tool.screenshot_url}
                    alt={`${tool.name} 截图`}
                    fill
                    className="object-cover"
                  />
                </div>
              </Card>
            )}
            
            {/* Tool Introduction */}
            {tool.introduction && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    工具介绍
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
                    <ReactMarkdown>{tool.introduction}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Use Cases */}
            {tool.use_cases && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    使用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-ol:text-muted-foreground">
                    <ReactMarkdown>{tool.use_cases}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            <ToolCommentsSection
              toolId={tool.id}
              initialUser={user}
              initialNickname={profile?.display_name ?? null}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
