/** 与 AdminRoleStatsCards / AdminTagStatsCards 同风格的网格统计头 */
export function AdminMenuStatsCards({
  categoriesTotal,
  categoriesEnabled,
  categoriesDisabled,
  membershipEdgesPublicListed,
  membershipEdgesTotal,
  distinctToolsPublicListed,
  distinctToolsTotal,
  categoryTagLinks,
  distinctLinkedTags,
}: {
  categoriesTotal: number
  categoriesEnabled: number
  categoriesDisabled: number
  /** 与前台 /category、junction 列表口径一致的挂载条数 */
  membershipEdgesPublicListed: number
  /** 库内 tool_categories 全表行数（含隐藏工具等） */
  membershipEdgesTotal: number
  distinctToolsPublicListed: number
  distinctToolsTotal: number
  /** 菜单↔标签运营联结（category_tags），与工具挂载正交 */
  categoryTagLinks: number
  distinctLinkedTags: number
}) {
  const items = (
    [
      { label: '产品线总数', value: categoriesTotal },
      {
        label: '前台启用',
        value: categoriesEnabled,
        hint: '未禁用，可出现 /category 与导航',
      },
      {
        label: '已禁用',
        value: categoriesDisabled,
        hint: '仅后台可见',
      },
      {
        label: '前台计入挂载条数',
        value: membershipEdgesPublicListed,
        hint: `已通过、工具未隐藏、分类未禁用；库内合计 ${membershipEdgesTotal} 行`,
      },
      {
        label: '前台至少一条挂载的工具（去重）',
        value: distinctToolsPublicListed,
        hint: `junction 去重工具总数（含隐藏等）${distinctToolsTotal}`,
      },
      {
        label: '产品线↔标签联结（条目）',
        value: categoryTagLinks,
        hint: 'category_tags，运营用；不参与 /category 工具列表',
      },
      {
        label: '出现在任一产品线的标签（去重）',
        value: distinctLinkedTags,
        hint: '至少在一条产品线下列过的不同标签',
      },
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
  ))

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {items}
    </div>
  )
}
