import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ToolCard } from '@/components/tool-card'
import { Heart, Sparkles } from 'lucide-react'
import type { Category, Tool, Profile } from '@/lib/types'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'

export const metadata = {
  title: '我的收藏 - AI工具集',
}

export default async function FavoritesPage() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login?redirect=/favorites')
  }
  
  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  // Get categories for sidebar
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  
  // Get user's favorites with tool data
  const { data: favorites } = await supabase
    .from('favorites')
    .select(`
      id,
      tool_id,
      created_at,
      tool:tools(*, category:categories(*))
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  
  // Filter out favorites where the tool is not approved or doesn't exist
  const validFavorites = favorites?.filter((f) => {
    const raw = f.tool as unknown
    const t = (Array.isArray(raw) ? raw[0] : raw) as Tool | undefined
    return t && t.status === 'approved'
  }) || []

  const favoriteTools = validFavorites.map((f) => {
    const raw = f.tool as unknown
    return (Array.isArray(raw) ? raw[0] : raw) as Tool
  })
  const favCounts =
    favoriteTools.length > 0
      ? await getFavoriteCountsByToolIds(
          supabase,
          favoriteTools.map((t) => t.id),
        )
      : {}

  return (
    <div className="min-h-screen bg-background">
      <Sidebar categories={(categories as Category[]) || []} />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile as Profile} />
        
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                  <Heart className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">我的收藏</h1>
                  <p className="text-sm text-muted-foreground">
                    共收藏 {validFavorites.length} 个工具
                  </p>
                </div>
              </div>
            </div>
            
            {/* Favorites Grid */}
            {validFavorites.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {validFavorites.map((favorite) => {
                  const raw = favorite.tool as unknown
                  const t = (Array.isArray(raw) ? raw[0] : raw) as Tool
                  return (
                    <ToolCard
                      key={favorite.id}
                      tool={t}
                      favoritesCount={favCounts[t.id] ?? 0}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">还没有收藏</h2>
                <p className="mt-2 text-muted-foreground">
                  浏览工具并点击心形图标来收藏喜欢的工具
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
