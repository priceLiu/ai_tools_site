import type { RoleCategory } from '@/lib/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * 「每个角色挂了几个标签」——与 Tabs 括号数字一致，这里整表摊开便于扫一眼。
 */
export function AdminRoleLinkBreakdown({
  roles,
  links,
}: {
  roles: RoleCategory[]
  links: { role_category_id: string; tag_id: string }[]
}) {
  const counts = new Map<string, number>()
  for (const l of links) {
    counts.set(l.role_category_id, (counts.get(l.role_category_id) ?? 0) + 1)
  }

  const rows = [...roles].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  if (rows.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">各角色 · 关联标签数</CardTitle>
          <CardDescription className="text-xs">
            尚无角色分类时无明细（请先迁移种子或点上文「创建」）。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">各角色 · 关联标签数</CardTitle>
        <CardDescription className="text-xs">
          与上方 Tab 角标括号内数字一致；点击 Tab 可做迁入 / 移除。
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">角色名称</th>
              <th className="py-2 pr-3 font-mono text-[11px]">slug</th>
              <th className="py-2 pr-3 font-medium">前台</th>
              <th className="py-2 pr-2 text-right font-medium tabular-nums">
                关联标签数
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const n = counts.get(r.id) ?? 0
              const on = !r.is_disabled
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                    {r.slug}
                  </td>
                  <td className="py-2 pr-3">
                    {on ? (
                      <Badge variant="outline" className="text-[10px]">
                        启用
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        禁用
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{n}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
