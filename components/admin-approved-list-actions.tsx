'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { AdminFeaturedToggle } from '@/components/admin-featured-toggle'
import { AdminDisableToggleButton } from '@/components/admin-disable-toggle-button'
import type { Tool } from '@/lib/types'

interface AdminApprovedListActionsProps {
  tool: Tool
  editHref: string
}

/** 与「审核中」一排一致；预览由列表 footer 统一置于本组左侧 */
export function AdminApprovedListActions({ tool, editHref }: AdminApprovedListActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild className="gap-1 text-sky-600 hover:text-sky-700">
        <Link href={editHref}>
          <Pencil className="h-3 w-3" />
          编辑
        </Link>
      </Button>
      <AdminFeaturedToggle
        toolId={tool.id}
        initialFeatured={tool.is_featured}
        appearance="toolbar"
      />
      <AdminDisableToggleButton
        toolId={tool.id}
        initialDisabled={Boolean(tool.is_disabled)}
        layout="toolbar"
      />
    </div>
  )
}
