import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { Tool } from '@/lib/types'

import { toolPublicPath } from '@/lib/tool-public-path'

/** 管理端列表「预览」在公开详情页通过此 query 隐藏评论（仅影响展示） */
export const ADMIN_TOOL_PREVIEW_QUERY = 'admin_preview=1'

/** 管理列表「预览」：已通过且 slug 存在 → 站点公开页（带 admin_preview）；否则 → 后台预览页 */
export function adminToolListPreviewHref(tool: Tool): string {
  if (tool.status === 'approved' && tool.slug?.trim()) {
    return `${toolPublicPath(tool.slug)}?${ADMIN_TOOL_PREVIEW_QUERY}`
  }
  return `/admin/tools/${tool.id}`
}

/** 与审核列表中「编辑 / 通过 / 拒绝」等按钮同尺寸、outline，新标签打开 */
export function AdminListPreviewButton({ tool }: { tool: Tool }) {
  const href = adminToolListPreviewHref(tool)
  return (
    <Button
      size="sm"
      variant="outline"
      asChild
      className="gap-1 text-sky-600 hover:text-sky-700"
    >
      <Link href={href} target="_blank" rel="noopener noreferrer">
        <Eye className="h-3 w-3 shrink-0" aria-hidden />
        预览
      </Link>
    </Button>
  )
}
