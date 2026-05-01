import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminToolActions } from '@/components/admin-tool-actions'
import { AdminFeaturedToggle } from '@/components/admin-featured-toggle'
import { ToolListRowCard } from '@/components/tool-list-row-card'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { buildAdminToolsSearchPattern } from '@/lib/admin-tools-search'
import { Shield, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Tool } from '@/lib/types'

export const metadata = {
  title: '管理后台 - AI工具集',
}

const LIST_LIMIT = 50
const ADMIN_SEARCH_LIMIT = 120

function adminDetailHref(tool: Tool) {
  return `/admin/tools/${tool.id}`
}

interface AdminPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createClient()
  const { q: rawQ } = await searchParams
  const searchTrim = rawQ?.trim() ?? ''
  const hasSearch = searchTrim.length > 0

  const pattern = hasSearch ? buildAdminToolsSearchPattern(searchTrim) : null

  const [
    pendingCountRes,
    approvedCountRes,
    rejectedCountRes,
    pendingToolsRes,
    approvedToolsRes,
    rejectedToolsRes,
  ] = await Promise.all([
    supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected'),
    supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
      supabase
        .from('tools')
        .select('*, category:categories(*)')
        .eq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT),
  ])

  let searchTools: Tool[] = []
  if (hasSearch && pattern) {
    const { data } = await supabase
      .from('tools')
      .select('*, category:categories(*)')
      .or(
        `name.ilike.${pattern},description.ilike.${pattern},slug.ilike.${pattern}`,
      )
      .order('updated_at', { ascending: false })
      .limit(ADMIN_SEARCH_LIMIT)
    searchTools = (data as Tool[]) || []
  }

  const pendingTotal = pendingCountRes.count ?? 0
  const approvedTotal = approvedCountRes.count ?? 0
  const rejectedTotal = rejectedCountRes.count ?? 0
  const pending = (pendingToolsRes.data as Tool[]) || []
  const approved = (approvedToolsRes.data as Tool[]) || []
  const rejected = (rejectedToolsRes.data as Tool[]) || []

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

  const renderCard = (
    tool: Tool,
    opts: {
      showApproveActions?: boolean
      showFeaturedToggle?: boolean
      statusBadge?: ReactNode
    } = {},
  ) => {
    const {
      showApproveActions = false,
      showFeaturedToggle = false,
      statusBadge,
    } = opts
    const href = adminDetailHref(tool)
    return (
      <ToolListRowCard
        key={tool.id}
        tool={tool}
        logoHref={href}
        titleHref={href}
        openLinksInNewTab
        statusBadge={statusBadge}
        footer={
          <div className="space-y-3">
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {tool.website_url}
            </a>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                提交于 {new Date(tool.created_at).toLocaleDateString('zh-CN')}
              </span>
              {showApproveActions ? <AdminToolActions toolId={tool.id} /> : null}
            </div>
            {showFeaturedToggle ? (
              <AdminFeaturedToggle
                toolId={tool.id}
                initialFeatured={tool.is_featured}
              />
            ) : null}
          </div>
        }
      />
    )
  }

  function renderSearchResultCard(tool: Tool) {
    return renderCard(tool, {
      statusBadge: toolStatusBadge(tool),
      showApproveActions: tool.status === 'pending',
      showFeaturedToggle: tool.status === 'approved',
    })
  }

  const approvedListTruncated =
    approvedTotal > LIST_LIMIT && approved.length === LIST_LIMIT
  const rejectedListTruncated =
    rejectedTotal > LIST_LIMIT && rejected.length === LIST_LIMIT

  return (
    <main className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">管理后台</h1>
              <p className="text-sm text-muted-foreground">
                审核和管理提交的 AI 工具
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingTotal}</p>
                <p className="text-sm text-muted-foreground">审核中</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{approvedTotal}</p>
                <p className="text-sm text-muted-foreground">已通过</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rejectedTotal}</p>
                <p className="text-sm text-muted-foreground">未通过</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          列表「已通过 / 未通过」各最多展示最近 {LIST_LIMIT} 条（数字为库里该状态总数）。顶部搜索为全站匹配，结果在下方单列展示；
          Tab 可随时切换原始列表。
        </p>

        {hasSearch ? (
          <div className="mb-8 rounded-lg border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                搜索结果「{searchTrim}」：共 {searchTools.length} 条（至多{' '}
                {ADMIN_SEARCH_LIMIT} 条），含审核状态。清除关键词后仅隐藏本区。
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">清除搜索</Link>
              </Button>
            </div>
            {searchTools.length > 0 ? (
              <div className="space-y-4">
                {searchTools.map((t) => renderSearchResultCard(t))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                没有匹配的工具，请尝试其他关键词；仍可在下方 Tab 浏览列表。
              </div>
            )}
          </div>
        ) : null}

        <Tabs defaultValue="pending">
          <TabsList className="mb-6 h-auto flex-wrap gap-1">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              审核中 ({pending.length}
              {pendingTotal !== pending.length ? ` / 共 ${pendingTotal}` : ''})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              已通过 ({approved.length}
              {approvedTotal !== approved.length ? ` / 共 ${approvedTotal}` : ''})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              未通过 ({rejected.length}
              {rejectedTotal !== rejected.length ? ` / 共 ${rejectedTotal}` : ''})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pending.length > 0 ? (
              <div className="space-y-4">
                {pending.map((t) => renderCard(t, { showApproveActions: true }))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                暂无审核中的工具
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved">
            {approvedListTruncated ? (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-500">
                仅显示最近 {LIST_LIMIT} 条；当前共有 {approvedTotal} 条已通过记录。
              </p>
            ) : null}
            {approved.length > 0 ? (
              <div className="space-y-4">
                {approved.map((t) => renderCard(t, { showFeaturedToggle: true }))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                暂无已通过的工具
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected">
            {rejectedListTruncated ? (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-500">
                仅显示最近 {LIST_LIMIT} 条；当前共有 {rejectedTotal} 条未通过记录。
              </p>
            ) : null}
            {rejected.length > 0 ? (
              <div className="space-y-4">
                {rejected.map((t) => renderCard(t))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                暂无未通过的工具
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
