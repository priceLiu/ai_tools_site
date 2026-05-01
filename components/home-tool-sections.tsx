import { ToolSection } from '@/components/tool-section'
import { Sparkles } from 'lucide-react'
import type { HomeToolBundle } from '@/lib/cached-home-data'

interface HomeToolSectionsProps {
  bundle: HomeToolBundle
}

export function HomeToolSections({ bundle }: HomeToolSectionsProps) {
  const { featured, latest, categoryTools } = bundle

  const hasAnyTools =
    featured.length > 0 || latest.length > 0 || categoryTools.length > 0

  return (
    <div className="mx-auto max-w-[1200px] space-y-10">
      <ToolSection
        title="热门工具"
        icon="hot"
        anchorId="home-hot"
        tools={featured}
        imagePriorityFirstN={6}
      />

      <ToolSection
        title="最新收录"
        icon="new"
        anchorId="home-latest"
        tools={latest}
        imagePriorityFirstN={4}
      />

      {categoryTools.map(({ category, tools }) => (
        <ToolSection
          key={category.id}
          title={category.name}
          anchorId={`home-cat-${category.slug}`}
          tools={tools}
        />
      ))}

      {!hasAnyTools && (
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
  )
}
