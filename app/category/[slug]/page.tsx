import { cache } from 'react'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { ToolCard } from '@/components/tool-card'
import type { Tool } from '@/lib/types'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import { collectSubtreeCategoryIds } from '@/lib/category-tree'
import * as neon from '@/lib/neon/data'
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
  type LucideIcon,
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

/** 60s ISR；分类内工具变更由后台 `revalidatePath('/category/<slug>')` 推送 */
export const revalidate = 60
export const dynamicParams = true

const getCategoryBySlugCached = cache((slug: string) =>
  neon.neonCategorySelectBySlug(slug),
)

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const cats = await neon.neonListCategoriesAll()
    return cats
      .map((c) => (c.slug ?? '').trim())
      .filter((s) => s.length > 0)
      .map((slug) => ({ slug }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[category/[slug] generateStaticParams] 跳过预生成:', e)
    }
    return []
  }
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params

  if (slug === 'hot') {
    return {
      title: '热门工具 - AI工具集',
      description: '发现最受欢迎的AI工具',
    }
  }

  const cat = await getCategoryBySlugCached(slug)
  if (!cat) {
    return { title: '分类未找到 - AI工具集' }
  }
  return {
    title: `${cat.name} - AI工具集`,
    description: `发现最好用的${cat.name}AI工具`,
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params

  const navigation = await getNavigationMenuTreeStatic()

  let tools: Tool[] = []
  let categoryName = ''
  let categoryIcon = ''

  if (slug === 'hot') {
    categoryName = '热门工具'
    categoryIcon = 'Flame'
    tools = await neon.neonListToolsFeaturedHome()
  } else {
    const category = await getCategoryBySlugCached(slug)
    if (!category) {
      notFound()
    }
    categoryName = category.name
    categoryIcon = category.icon || ''
    const hierarchy = await neon.neonListCategoryIdParent()
    const subtreeIds = collectSubtreeCategoryIds(hierarchy, category.id)
    tools = await neon.neonListToolsForCategoryIds(subtreeIds)
  }

  const Icon = iconMap[categoryIcon] || Sparkles

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} enableHomeAnchors />

      <div className="pl-16 md:pl-64">
        <HeaderUser />

        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
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
