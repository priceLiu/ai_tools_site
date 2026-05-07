export function AdminTagStatsCards({
  totalTags,
  curated,
  uncurated,
  curatedToolLinks,
  uncuratedToolLinks,
  categoriesCount,
}: {
  totalTags: number
  curated: number
  uncurated: number
  curatedToolLinks: number
  uncuratedToolLinks: number
  categoriesCount: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(
        [
          { label: '总标签数', value: totalTags },
          { label: 'Curated 标签', value: curated, hint: '受保护的官方词表' },
          {
            label: '待清理标签',
            value: uncurated,
            hint: '历史落库的非官方词',
          },
          {
            label: 'Curated 工具关联',
            value: curatedToolLinks,
            hint: '已挂在 curated 标签上的 tool_tags 数',
          },
          {
            label: '待清理工具关联',
            value: uncuratedToolLinks,
            hint: '挂在非 curated 标签上、需合并/重打的 tool_tags 数',
          },
          { label: '场景分类', value: categoriesCount },
        ] as const
      ).map((it) => (
        <div
          key={it.label}
          className="rounded-md border bg-card p-3 text-center"
        >
          <div className="text-2xl font-semibold tabular-nums">{it.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{it.label}</div>
          {'hint' in it && it.hint ? (
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">
              {it.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
