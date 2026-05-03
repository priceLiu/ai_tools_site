import { ToolSection } from '@/components/tool-section'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { idsEqual } from '@/lib/category-tree'
import type { HomeToolBundle } from '@/lib/cached-home-data'

interface HomeToolSectionsProps {
  bundle: HomeToolBundle
}

export function HomeToolSections({ bundle }: HomeToolSectionsProps) {
  const { featured, latest, homeCategoryBlocks } = bundle

  const hasAnyListedTool =
    featured.length > 0 ||
    latest.length > 0 ||
    homeCategoryBlocks.some((b) =>
      b.sections.some((s) => s.tools.length > 0),
    )

  return (
    <div className="mx-auto w-full max-w-[min(100%,94rem)] space-y-10 px-0 sm:px-1">
      <ToolSection
        title="热门工具"
        icon="hot"
        anchorId="home-hot"
        tools={featured}
        imagePriorityFirstN={10}
      />

      <ToolSection
        title="最新收录"
        icon="new"
        anchorId="home-latest"
        tools={latest}
        imagePriorityFirstN={5}
      />

      {homeCategoryBlocks.map(({ root, sections }) => {
        const visibleSections = sections.filter((s) => s.tools.length > 0)
        if (visibleSections.length === 0) return null

        const showPrimaryBand =
          visibleSections.length > 1 ||
          visibleSections.some((s) => !idsEqual(s.category.id, root.id))
        return (
          <div key={root.id} className="space-y-4">
            {showPrimaryBand ? (
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {root.name}
              </h2>
            ) : null}
            <div
              className={cn(
                'space-y-8',
                showPrimaryBand &&
                  'border-l-2 border-border/80 py-1 pl-4 md:pl-5',
              )}
            >
              {visibleSections.map(({ category, tools }) => (
                <ToolSection
                  key={category.id}
                  title={category.name}
                  anchorId={`home-cat-${category.slug}`}
                  tools={tools}
                />
              ))}
            </div>
          </div>
        )
      })}

      {!hasAnyListedTool && homeCategoryBlocks.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">暂无工具</h2>
          <p className="mt-2 text-muted-foreground">
            成为第一个提交AI工具的用户吧！
          </p>
        </div>
      ) : null}
    </div>
  )
}
