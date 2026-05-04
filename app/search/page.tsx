import { getAuthUser } from '@/lib/auth/session'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ToolCard } from '@/components/tool-card'
import { Search as SearchIcon } from 'lucide-react'
import type { Tool, Profile } from '@/lib/types'
import { getNavigationMenuTree } from '@/lib/navigation-menu'
import * as neon from '@/lib/neon/data'
import { getSessionProfile } from '@/lib/server-profile'

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
  const navigation = await getNavigationMenuTree()

  const user = await getAuthUser()

  const profile = user ? await getSessionProfile(user.id) : null

  // Search tools
  let tools: Tool[] = []
  if (q && q.trim()) {
    tools = await neon.neonSearchToolsPublic(q)
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} enableHomeAnchors />
      
      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile as Profile | null} />
        
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
              <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                {tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
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
