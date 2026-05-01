/** 首页工具区分区加载占位，与 ToolSection + ToolCard 大致高度对齐 */
export function HomeToolSectionsSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-10">
      {[0, 1, 2].map((section) => (
        <section key={section} className="space-y-4">
          <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
          <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-muted"
                style={{ width: 350, height: 100 }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
