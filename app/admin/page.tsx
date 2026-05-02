import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AdminToolActions } from '@/components/admin-tool-actions'
import { AdminApprovedListActions } from '@/components/admin-approved-list-actions'
import { ToolListRowCard } from '@/components/tool-list-row-card'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { buildAdminToolsSearchPattern } from '@/lib/admin-tools-search'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { AdminListPreviewButton } from '@/components/admin-list-preview-button'
import { Shield, Clock, CheckCircle, XCircle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { Tool } from '@/lib/types'

export const metadata = {
  title: '管理后台 - AI工具集',
}

const PAGE_SIZE = 10
const ADMIN_SEARCH_LIMIT = 120

type AdminTab = 'pending' | 'approved' | 'rejected'

function parseTab(raw: string | undefined): AdminTab {
  if (raw === 'approved' || raw === 'rejected') return raw
  return 'pending'
}

function buildAdminHref(opts: { tab: AdminTab; page?: number; q?: string }) {
  const p = new URLSearchParams()
  if (opts.q?.trim()) p.set('q', opts.q.trim())
  if (opts.tab !== 'pending') p.set('tab', opts.tab)
  if (opts.page && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return s ? `/admin?${s}` : '/admin'
}

function adminDetailHref(tool: Tool) {
  return `/admin/tools/${tool.id}`
}

interface AdminPageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-2 border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
          : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/80 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const rawQ = params.q ?? ''
  const searchTrim = rawQ.trim()
  const hasSearch = searchTrim.length > 0

  const tab = parseTab(params.tab)
  const rawPage = parseInt(params.page ?? '1', 10)
  const pageNum =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  const pattern = hasSearch ? buildAdminToolsSearchPattern(searchTrim) : null

  const [
    pendingCountRes,
    approvedCountRes,
    rejectedCountRes,
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
  ])

  const pendingTotal = pendingCountRes.count ?? 0
  const approvedTotal = approvedCountRes.count ?? 0
  const rejectedTotal = rejectedCountRes.count ?? 0

  const totalForTab =
    tab === 'pending'
      ? pendingTotal
      : tab === 'approved'
        ? approvedTotal
        : rejectedTotal

  const totalPages = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE))
  const safePage = Math.min(pageNum, totalPages)
  const from = (safePage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const fetchTabSlice = async (status: 'pending' | 'approved' | 'rejected') => {
    const { data } = await supabase
      .from('tools')
      .select('*, category:categories(*)')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, to)
    return (data as Tool[]) || []
  }

  let tabList: Tool[] = []
  if (tab === 'pending') {
    tabList = await fetchTabSlice('pending')
  } else if (tab === 'approved') {
    tabList = await fetchTabSlice('approved')
  } else {
    tabList = await fetchTabSlice('rejected')
  }

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

  const qOpt = searchTrim.length > 0 ? searchTrim : undefined

  const renderCard = (
    tool: Tool,
    opts: {
      showApproveActions?: boolean
      showApprovedListActions?: boolean
      statusBadge?: ReactNode
    } = {},
  ) => {
    const {
      showApproveActions = false,
      showApprovedListActions = false,
      statusBadge,
    } = opts
    const href = adminDetailHref(tool)
    return (
      <ToolListRowCard
        key={tool.id}
        tool={tool}
        logoHref={href}
        titleHref={href}
        openLogoInNewTab
        statusBadge={statusBadge}
        density="compact"
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
                {showApproveActions ? <AdminToolActions toolId={tool.id} /> : null}
                {showApprovedListActions ? (
                  <AdminApprovedListActions tool={tool} editHref={href} />
                ) : null}
              </div>
            </div>
          </div>
        }
      />
    )
  }

  function renderSearchResultCard(tool: Tool) {
    return renderCard(tool, {
      statusBadge: toolStatusBadge(tool),
      showApproveActions: tool.status === 'pending',
      showApprovedListActions: tool.status === 'approved',
    })
  }

  const prevHref =
    safePage > 1
      ? buildAdminHref({ tab, page: safePage - 1, q: qOpt })
      : null
  const nextHref =
    safePage < totalPages
      ? buildAdminHref({ tab, page: safePage + 1, q: qOpt })
      : null

  let tabPanel: ReactNode = null

  if (tab === 'pending') {
    tabPanel =
      tabList.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {tabList.map((t) => renderCard(t, { showApproveActions: true }))}
          </div>
          {totalPages > 1 ? (
            <AdminPagination
              safePage={safePage}
              totalPages={totalPages}
              prevHref={prevHref}
              nextHref={nextHref}
            />
          ) : null}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无审核中的工具
        </div>
      )
  } else if (tab === 'approved') {
    tabPanel =
      tabList.length > 0 ? (
        <>
          <p className="mb-1.5 text-xs text-muted-foreground">
            预览为新标签打开：已通过 → 公开详情（带 admin_preview，不展示评论）；其余 → 后台预览；点标题进编辑。
          </p>
          <div className="space-y-1.5">
            {tabList.map((t) =>
              renderCard(t, {
                showApprovedListActions: true,
              }),
            )}
          </div>
          {totalPages > 1 ? (
            <AdminPagination
              safePage={safePage}
              totalPages={totalPages}
              prevHref={prevHref}
              nextHref={nextHref}
            />
          ) : null}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无已通过的工具
        </div>
      )
  } else {
    tabPanel =
      tabList.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {tabList.map((t) => renderCard(t))}
          </div>
          {totalPages > 1 ? (
            <AdminPagination
              safePage={safePage}
              totalPages={totalPages}
              prevHref={prevHref}
              nextHref={nextHref}
            />
          ) : null}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无未通过的工具
        </div>
      )
  }

  return (
    <main className="p-3 md:p-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground md:text-2xl">管理后台</h1>
              <p className="text-xs text-muted-foreground md:text-sm">
                审核和管理提交的 AI 工具
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{pendingTotal}</p>
                <p className="text-xs text-muted-foreground">审核中</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{approvedTotal}</p>
                <p className="text-xs text-muted-foreground">已通过</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{rejectedTotal}</p>
                <p className="text-xs text-muted-foreground">未通过</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          各 Tab 列表每页 {PAGE_SIZE} 条，数字为库里该状态总数。顶部搜索为全站匹配（至多 {ADMIN_SEARCH_LIMIT}{' '}
          条）；清除关键词后仅隐藏搜索区。
        </p>

        {hasSearch ? (
          <div className="mb-5 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground md:text-sm">
                搜索结果「{searchTrim}」：共 {searchTools.length} 条，含审核状态。
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">清除搜索</Link>
              </Button>
            </div>
            {searchTools.length > 0 ? (
              <div className="space-y-1.5">
                {searchTools.map((t) => renderSearchResultCard(t))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground md:text-sm">
                没有匹配的工具；仍可在下方 Tab 浏览分页列表。
              </div>
            )}
          </div>
        ) : null}

        <div className="inline-flex w-full max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-2 md:w-fit">
          <TabLink
            href={buildAdminHref({ tab: 'pending', page: 1, q: qOpt })}
            active={tab === 'pending'}
          >
            <Clock className="h-4 w-4 shrink-0" />
            审核中 ({pendingTotal})
          </TabLink>
          <TabLink
            href={buildAdminHref({ tab: 'approved', page: 1, q: qOpt })}
            active={tab === 'approved'}
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            已通过 ({approvedTotal})
          </TabLink>
          <TabLink
            href={buildAdminHref({ tab: 'rejected', page: 1, q: qOpt })}
            active={tab === 'rejected'}
          >
            <XCircle className="h-4 w-4 shrink-0" />
            未通过 ({rejectedTotal})
          </TabLink>
        </div>

        <div className="mt-3">{tabPanel}</div>
      </div>
    </main>
  )
}

function AdminPagination({
  safePage,
  totalPages,
  prevHref,
  nextHref,
}: {
  safePage: number
  totalPages: number
  prevHref: string | null
  nextHref: string | null
}) {
  return (
    <Pagination className="mt-3 justify-end">
      <PaginationContent className="flex-wrap justify-end gap-1">
        <PaginationItem>
          {prevHref ? (
            <PaginationLink
              href={prevHref}
              size="default"
              className="gap-1 px-2.5 sm:pl-2.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>上一页</span>
            </PaginationLink>
          ) : (
            <span
              className={cn(
                'inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground opacity-50',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </span>
          )}
        </PaginationItem>
        <PaginationItem>
          <span className="flex h-9 items-center px-2 text-sm tabular-nums text-muted-foreground">
            第 {safePage} / {totalPages} 页
          </span>
        </PaginationItem>
        <PaginationItem>
          {nextHref ? (
            <PaginationLink
              href={nextHref}
              size="default"
              className="gap-1 px-2.5 sm:pr-2.5"
            >
              <span>下一页</span>
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          ) : (
            <span
              className={cn(
                'inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground opacity-50',
              )}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
