import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Sparkles, Clock, CheckCircle, XCircle, AlertCircle, Pencil } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToolListRowCard } from '@/components/tool-list-row-card'
import type { Tool } from '@/lib/types'

export const submissionStatusConfig = {
  pending: {
    label: '审核中',
    icon: Clock,
    variant: 'secondary' as const,
    className: 'text-yellow-600',
  },
  approved: {
    label: '已通过',
    icon: CheckCircle,
    variant: 'default' as const,
    className: 'text-green-600',
  },
  rejected: {
    label: '未通过',
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'text-red-600',
  },
}

function ownerDetailHref(tool: Tool) {
  if (tool.status === 'approved') return `/tool/${tool.slug}`
  return `/account/submissions/${tool.id}`
}

interface UserSubmissionsListProps {
  tools: Tool[]
  emptyTitle: string
  emptyDescription: string
  submitHref?: string
  favoriteCounts?: Record<string, number>
}

export function UserSubmissionsList({
  tools,
  emptyTitle,
  emptyDescription,
  submitHref = '/submit',
  favoriteCounts = {},
}: UserSubmissionsListProps) {
  if (!tools.length) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
        <p className="mt-2 text-muted-foreground">{emptyDescription}</p>
        <Button asChild className="mt-6">
          <Link href={submitHref}>
            <Plus className="mr-2 h-4 w-4" />
            提交工具
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tools.map((tool: Tool) => {
        const status = submissionStatusConfig[tool.status]
        const StatusIcon = status.icon
        const href = ownerDetailHref(tool)
        const fav = favoriteCounts[tool.id] ?? 0

        const statusBadge = (
          <Badge variant={status.variant} className="shrink-0">
            <StatusIcon className={`mr-1 h-3 w-3 ${status.className}`} />
            {status.label}
          </Badge>
        )

        return (
          <ToolListRowCard
            key={tool.id}
            tool={tool}
            logoHref={href}
            titleHref={href}
            favoritesCount={fav}
            statusBadge={statusBadge}
            footer={
              <>
                <p className="text-xs text-muted-foreground">
                  提交于 {new Date(tool.created_at).toLocaleDateString('zh-CN')}
                </p>
                {tool.status === 'rejected' ? (
                  <>
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle />
                      <AlertTitle>审核未通过</AlertTitle>
                      <AlertDescription className="whitespace-pre-wrap text-destructive/90">
                        {tool.rejection_reason?.trim()
                          ? tool.rejection_reason
                          : '管理员未填写具体原因，请对照站点规范修改后重新提交。'}
                      </AlertDescription>
                    </Alert>
                    <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
                      <Link href={`/submit?edit=${tool.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                        修改并重新提交审核
                      </Link>
                    </Button>
                  </>
                ) : null}
              </>
            }
          />
        )
      })}
    </div>
  )
}
