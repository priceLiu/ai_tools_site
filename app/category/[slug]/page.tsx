import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ToolCard } from '@/components/tool-card'
import type { Tool, Profile } from '@/lib/types'
import { getNavigationMenuTree } from '@/lib/navigation-menu'
import { collectSubtreeCategoryIds } from '@/lib/category-tree'
import {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
  Sparkles,
  type LucideIcon
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  
  // Handle special 'hot' category
  if (slug === 'hot') {
    return {
      title: '热门工具 - AI工具集',
      description: '发现最受欢迎的AI工具',
    }
  }
  
  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', slug)
    .single()
  
  if (!category) {
    return { title: '分类未找到 - AI工具集' }
  }
  
  return {
    title: `${category.name} - AI工具集`,
    description: `发现最好用的${category.name}AI工具`,
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
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

  const navigation = await getNavigationMenuTree()

  let tools: Tool[] = []
  let categoryName = ''
  let categoryIcon = ''
  
  // Handle special 'hot' category (featured tools)
  if (slug === 'hot') {
    categoryName = '热门工具'
    categoryIcon = 'Flame'
    
    const { data } = await supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'approved')
      .eq('is_featured', true)
      .order('view_count', { ascending: false })
    
    tools = data || []
  } else {
    // Get the specific category
    const { data: category } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single()
    
    if (!category) {
      notFound()
    }
    
    categoryName = category.name
    categoryIcon = category.icon || ''
    
    const { data: hierarchy } = await supabase
      .from('categories')
      .select('id,parent_id')

    const subtreeIds = collectSubtreeCategoryIds(hierarchy ?? [], category.id)

    // Get tools in this category and descendants (二级分类下的工具汇总到父分类页)
    const { data } = await supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'approved')
      .in('category_id', subtreeIds)
      .order('view_count', { ascending: false })

    tools = data || []
  }
  
  const Icon = iconMap[categoryIcon] || Sparkles

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />
        
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Category Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
                  <p className="text-sm text-muted-foreground">
                    共 {tools.length} 个工具
                  </p>
                </div>
              </div>
            </div>
            
            {/* Tools Grid */}
            {tools.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                {tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">暂无工具</h2>
                <p className="mt-2 text-muted-foreground">
                  该分类下还没有收录任何工具
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
