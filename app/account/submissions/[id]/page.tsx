import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { ToolDetailView } from '@/components/tool-detail-view'
import { toolDetailMaxWidthClass } from '@/lib/tool-detail-layout'
import { cn } from '@/lib/utils'
import type { Tool } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { title: '工具详情' }
  const { data: tool } = await supabase
    .from('tools')
    .select('name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  return { title: tool?.name ? `${tool.name} - 详情` : '工具详情' }
}

export default async function AccountSubmissionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/auth/login?redirect=${encodeURIComponent(`/account/submissions/${id}`)}`,
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: row } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) notFound()

  const tool = row as Tool
  const status = submissionStatusConfig[tool.status]
  const StatusIcon = status.icon

  const submissionLogoHref =
    tool.status === 'approved' && tool.slug?.trim()
      ? `/tool/${tool.slug.trim()}`
      : `/account/submissions/${tool.id}`

  const panelFooter =
    tool.status === 'rejected' && tool.rejection_reason?.trim() ? (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
        <p className="font-medium">拒绝原因</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">
          {tool.rejection_reason}
        </p>
      </div>
    ) : null

  return (
    <div className={cn(toolDetailMaxWidthClass)}>
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
        <Link href="/account/history">
          <ArrowLeft className="h-4 w-4" />
          返回工具提交历史
        </Link>
      </Button>

      <ToolDetailView
        tool={tool}
        logoHref={submissionLogoHref}
        badges={
          <>
            <Badge variant={status.variant}>
              <StatusIcon className={`mr-1 h-3 w-3 ${status.className}`} />
              {status.label}
            </Badge>
            {tool.category ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {tool.category.name}
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground">
              阅读量 {tool.view_count ?? 0} · 收藏{' '}
              {(tool.favorite_count ?? 0).toLocaleString()}
            </span>
          </>
        }
        headerActions={
          <Button asChild>
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              访问网站
            </a>
          </Button>
        }
        panelFooter={panelFooter}
        commentsInitialUser={user}
        commentsInitialNickname={profile?.display_name ?? null}
      >
        {tool.status === 'approved' ? (
          <Button asChild className="mt-6">
            <Link href={`/tool/${tool.slug}`}>查看站点公开页</Link>
          </Button>
        ) : null}
      </ToolDetailView>
    </div>
  )
}
