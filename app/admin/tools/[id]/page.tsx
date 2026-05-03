import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { AdminApprovedToolEditor } from '@/components/admin-approved-tool-editor'
import { ToolDetailView } from '@/components/tool-detail-view'
import {
  toolDetailPageGutterClass,
  toolDetailMaxWidthClass,
} from '@/lib/tool-detail-layout'
import type { Category, Tool } from '@/lib/types'
import { toolPublicPath } from '@/lib/tool-public-path'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: tool } = await supabase.from('tools').select('name').eq('id', id).maybeSingle()
  return { title: tool?.name ? `${tool.name} - 后台预览` : '工具预览' }
}

export default async function AdminToolPreviewPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('id', id)
    .maybeSingle()

  if (!row) notFound()

  const tool = row as Tool

  const { data: categoriesRows } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  const categories = (categoriesRows || []) as Category[]
  const status = submissionStatusConfig[tool.status]
  const StatusIcon = status.icon

  const adminPreviewLogoHref =
    tool.status === 'approved' && tool.slug?.trim()
      ? toolPublicPath(tool.slug.trim())
      : `/admin/tools/${tool.id}`

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
    <div className={toolDetailPageGutterClass}>
      <div className={toolDetailMaxWidthClass}>
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>

        <ToolDetailView
        tool={tool}
        logoHref={adminPreviewLogoHref}
        showComments={false}
        badges={
          <>
            <Badge variant={status.variant}>
              <StatusIcon className={`mr-1 h-3 w-3 ${status.className}`} />
              {status.label}
            </Badge>
            {tool.is_disabled ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                前台已禁用
              </span>
            ) : null}
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
      >
        <div className="mt-6">
          <AdminApprovedToolEditor
            key={`${tool.id}-${tool.updated_at}`}
            toolId={tool.id}
            toolStatus={tool.status}
            initialName={tool.name}
            initialDescription={tool.description}
            initialWebsiteUrl={tool.website_url}
            initialLogoUrl={tool.logo_url}
            initialScreenshotUrl={tool.screenshot_url}
            initialIntroduction={tool.introduction ?? ''}
            initialIntroductionFormat={normalizeIntroductionFormat(
              tool.introduction_format,
            )}
            initialCategoryId={tool.category_id}
            staleCategoryId={
              tool.category_id && !tool.category ? tool.category_id : null
            }
            initialDisabled={Boolean(tool.is_disabled)}
            initialFeatured={Boolean(tool.is_featured)}
            categories={categories}
          />
        </div>
      </ToolDetailView>
      </div>
    </div>
  )
}
