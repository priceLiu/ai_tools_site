'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Tool } from '@/lib/types'
import { ToolListRowCard } from '@/components/tool-list-row-card'
import { AdminToolActions } from '@/components/admin-tool-actions'
import { AdminApprovedListActions } from '@/components/admin-approved-list-actions'
import { AdminListPreviewButton } from '@/components/admin-list-preview-button'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { setToolsHiddenAdminAction } from '@/app/admin/tools/actions'

export type AdminToolsBulkVariant =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden'
  | 'search'

function adminDetailHref(tool: Tool) {
  return `/admin/tools/${tool.id}`
}

function toolStatusBadge(tool: Tool): ReactNode {
  const status = submissionStatusConfig[tool.status]
  const StatusIcon = status.icon
  return (
    <Badge variant={status.variant} className="shrink-0">
      <StatusIcon className={`mr-1 h-3 w-3 ${status.className}`} />
      {status.label}
    </Badge>
  )
}

interface AdminToolsBulkPanelProps {
  tools: Tool[]
  variant: AdminToolsBulkVariant
  /** 列表为空时的提示文案 */
  emptyMessage: string
  /** 已通过 Tab 顶部的灰色说明 */
  approvedHint?: string
  pagination?: ReactNode
}

export function AdminToolsBulkPanel({
  tools,
  variant,
  emptyMessage,
  approvedHint,
  pagination,
}: AdminToolsBulkPanelProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bulkPending, setBulkPending] = useState(false)

  /** 仅 approved / hidden 这两个 Tab 提供批量操作；search/pending/rejected 不提供 */
  const bulkAction =
    variant === 'approved'
      ? ('hide' as const)
      : variant === 'hidden'
        ? ('unhide' as const)
        : null

  const pageIds = tools.map((t) => t.id)
  const pageIdsKey = pageIds.join(',')

  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
  const someOnPageSelected = pageIds.some((id) => selected.includes(id))

  useEffect(() => {
    setSelected([])
    setError(null)
  }, [pageIdsKey])

  const setRowSelected = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((x) => x !== id),
    )
  }

  const toggleSelectAllPage = (next: boolean) => {
    if (next) {
      setSelected((prev) => {
        const s = new Set(prev)
        for (const id of pageIds) s.add(id)
        return Array.from(s)
      })
    } else {
      const drop = new Set(pageIds)
      setSelected((prev) => prev.filter((id) => !drop.has(id)))
    }
  }

  const handleConfirmBulk = async () => {
    if (selected.length === 0 || !bulkAction) return

    setError(null)
    setBulkPending(true)
    try {
      const res = await setToolsHiddenAdminAction({
        toolIds: selected,
        hidden: bulkAction === 'hide',
      })
      if (res.error) {
        setError(res.error)
        setConfirmOpen(false)
        return
      }
      setConfirmOpen(false)
      setSelected([])
      router.refresh()
    } finally {
      setBulkPending(false)
    }
  }

  const renderCard = (tool: Tool) => {
    const href = adminDetailHref(tool)
    const showApproveActions = variant === 'pending'
    const showApprovedListActions =
      variant === 'approved' || variant === 'hidden'
    const showSearchApprove = variant === 'search' && tool.status === 'pending'
    const showSearchApproved =
      variant === 'search' && tool.status === 'approved'

    const statusBadge =
      variant === 'search' ? toolStatusBadge(tool) : undefined

    return (
      <ToolListRowCard
        key={tool.id}
        tool={tool}
        logoHref={href}
        titleHref={href}
        openLogoInNewTab
        statusBadge={statusBadge}
        density="compact"
        leadingControl={
          bulkAction != null ? (
            <Checkbox
              checked={selected.includes(tool.id)}
              onCheckedChange={(v) => setRowSelected(tool.id, v === true)}
              aria-label={`选择 ${tool.name}`}
              onClick={(e) => e.stopPropagation()}
            />
          ) : null
        }
        footer={
          <div className="space-y-1">
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {tool.website_url}
            </a>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                提交于 {new Date(tool.created_at).toLocaleDateString('zh-CN')}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <AdminListPreviewButton tool={tool} />
                {showApproveActions || showSearchApprove ? (
                  <AdminToolActions toolId={tool.id} />
                ) : null}
                {showApprovedListActions || showSearchApproved ? (
                  <AdminApprovedListActions tool={tool} editHref={href} />
                ) : null}
              </div>
            </div>
          </div>
        }
      />
    )
  }

  if (tools.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      {variant === 'approved' && approvedHint ? (
        <p className="mb-1.5 text-xs text-muted-foreground">{approvedHint}</p>
      ) : null}

      {bulkAction != null ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={
                pageIds.length === 0
                  ? false
                  : allOnPageSelected
                    ? true
                    : someOnPageSelected
                      ? 'indeterminate'
                      : false
              }
              onCheckedChange={(v) => toggleSelectAllPage(v === true)}
              aria-label="全选本页"
            />
            <span className="text-muted-foreground">全选本页</span>
          </label>
          <Button
            type="button"
            variant={bulkAction === 'hide' ? 'destructive' : 'default'}
            size="sm"
            disabled={selected.length === 0 || bulkPending}
            onClick={() => setConfirmOpen(true)}
          >
            {bulkAction === 'hide' ? '隐藏选中' : '还原选中'}
            {selected.length > 0 ? ` (${selected.length})` : null}
          </Button>
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {tools.map((t) => renderCard(t))}
      </div>

      {pagination}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'hide'
                ? '确认隐藏所选工具？'
                : '确认还原所选工具？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'hide'
                ? `将把 ${selected.length} 条工具的 is_disabled 置为 true，前台立即不再展示；数据完整保留，可在「已隐藏」Tab 一键还原。`
                : `将把 ${selected.length} 条工具的 is_disabled 置为 false，前台恢复展示。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>取消</AlertDialogCancel>
            <Button
              type="button"
              disabled={bulkPending}
              className={
                bulkAction === 'hide'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
              onClick={() => void handleConfirmBulk()}
            >
              {bulkPending
                ? '处理中…'
                : bulkAction === 'hide'
                  ? '确认隐藏'
                  : '确认还原'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
