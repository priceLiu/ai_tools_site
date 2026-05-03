/** 首页工具区分区加载占位，与 ToolSection + ToolCard 大致高度对齐 */
export function HomeToolSectionsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[min(100%,94rem)] space-y-10 px-0 sm:px-1">
      {[0, 1, 2].map((section) => (
        <section key={section} className="space-y-4">
          <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-[100px] min-w-0 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
