export function AdminRoleStatsCards({
  rolesTotal,
  rolesEnabled,
  rolesDisabled,
  roleTagLinks,
  distinctLinkedTags,
  totalTagsLibrary,
}: {
  rolesTotal: number
  rolesEnabled: number
  rolesDisabled: number
  roleTagLinks: number
  distinctLinkedTags: number
  totalTagsLibrary: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(
        [
          { label: '角色分类总数', value: rolesTotal },
          {
            label: '前台启用',
            value: rolesEnabled,
            hint: '首页「按角色」与 /role 可访问',
          },
          {
            label: '已禁用',
            value: rolesDisabled,
            hint: '仅后台可见',
          },
          {
            label: '角色—标签联结',
            value: roleTagLinks,
            hint: '条目数（一角多标会重复计数）',
          },
          {
            label: '已挂角色的标签（去重）',
            value: distinctLinkedTags,
            hint: '至少关联到一个角色的不同标签个数',
          },
          {
            label: '全库标签数',
            value: totalTagsLibrary,
            hint: '可被迁入任意角色的候选池',
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
      ))}
    </div>
  )
}
