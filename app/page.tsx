import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ToolSection } from '@/components/tool-section'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'
import { Sparkles } from 'lucide-react'
import type { Category, Tool, Profile } from '@/lib/types'

export default async function HomePage() {
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
  
  // Get categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  
  // Get featured tools (hot tools)
  const { data: featuredTools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('view_count', { ascending: false })
    .limit(8)
  
  // Get latest tools
  const { data: latestTools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(8)
  
  // Get tools by category (first few categories)
  const categoryTools: { category: Category; tools: Tool[] }[] = []
  if (categories && categories.length > 1) {
    for (const cat of categories.slice(1, 4)) {
      const { data: tools } = await supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'approved')
        .eq('category_id', cat.id)
        .order('view_count', { ascending: false })
        .limit(8)
      
      if (tools && tools.length > 0) {
        categoryTools.push({ category: cat, tools: tools as Tool[] })
      }
    }
  }

  const favToolIds = [
    ...((featuredTools as Tool[]) ?? []).map((t) => t.id),
    ...((latestTools as Tool[]) ?? []).map((t) => t.id),
    ...categoryTools.flatMap(({ tools }) => tools.map((t) => t.id)),
  ]
  const favoriteCounts = await getFavoriteCountsByToolIds(supabase, [
    ...new Set(favToolIds),
  ])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar categories={(categories as Category[]) || []} />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />
        
        <main className="p-4 md:p-6">
          {/* Hero Section */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">AI工具集</h1>
            <p className="mt-2 text-muted-foreground">发现全网最好用的AI工具</p>
          </div>
          
          {/* Tools Sections */}
          <div className="mx-auto max-w-7xl space-y-8">
            <ToolSection
              title="热门工具"
              icon="hot"
              tools={(featuredTools as Tool[]) || []}
              href="/category/hot"
              favoriteCounts={favoriteCounts}
            />
            
            <ToolSection
              title="最新收录"
              icon="new"
              tools={(latestTools as Tool[]) || []}
              favoriteCounts={favoriteCounts}
            />
            
            {categoryTools.map(({ category, tools }) => (
              <ToolSection
                key={category.id}
                title={category.name}
                tools={tools}
                href={`/category/${category.slug}`}
                favoriteCounts={favoriteCounts}
              />
            ))}
            
            {/* Empty State */}
            {(!featuredTools || featuredTools.length === 0) && 
             (!latestTools || latestTools.length === 0) && (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">暂无工具</h2>
                <p className="mt-2 text-muted-foreground">
                  成为第一个提交AI工具的用户吧！
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
