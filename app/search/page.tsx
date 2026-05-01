import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ToolCard } from '@/components/tool-card'
import { Search as SearchIcon } from 'lucide-react'
import type { Category, Tool, Profile } from '@/lib/types'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  return {
    title: q ? `搜索: ${q} - AI工具集` : '搜索 - AI工具集',
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get profile if logged in
  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }
  
  // Get categories for sidebar
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  
  // Search tools
  let tools: Tool[] = []
  if (q && q.trim()) {
    const { data } = await supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'approved')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('view_count', { ascending: false })
    
    tools = data || []
  }

  const favCounts =
    tools.length > 0
      ? await getFavoriteCountsByToolIds(
          supabase,
          tools.map((t) => t.id),
        )
      : {}

  return (
    <div className="min-h-screen bg-background">
      <Sidebar categories={(categories as Category[]) || []} />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />
        
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Search Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <SearchIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {q ? `搜索: "${q}"` : '搜索'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {q ? `找到 ${tools.length} 个结果` : '输入关键词搜索AI工具'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Results */}
            {q && tools.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    favoritesCount={favCounts[tool.id] ?? 0}
                  />
                ))}
              </div>
            ) : q ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <SearchIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">未找到结果</h2>
                <p className="mt-2 text-muted-foreground">
                  没有找到与 &ldquo;{q}&rdquo; 相关的工具
                </p>
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <SearchIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">开始搜索</h2>
                <p className="mt-2 text-muted-foreground">
                  在搜索框中输入关键词来查找AI工具
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
