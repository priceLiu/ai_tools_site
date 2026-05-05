import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import type { AdminCommentVisibilityFilter } from '@/lib/neon/data'
import { AdminCommentCategoryChart } from '@/components/admin-comment-category-chart'
import {
  AdminCommentMutePanel,
  AdminCommentsTable,
} from '@/components/admin-comments-interactive'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { toolPublicPath } from '@/lib/tool-public-path'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '评论管理 - 管理后台',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

function parseVis(
  raw: string | undefined,
): AdminCommentVisibilityFilter {
  if (raw === 'visible' || raw === 'hidden') return raw
  return 'all'
}

function adminCommentsHref(opts: {
  q?: string
  vis?: AdminCommentVisibilityFilter
  page?: number
}) {
  const p = new URLSearchParams()
  if (opts.q?.trim()) p.set('q', opts.q.trim())
  if (opts.vis && opts.vis !== 'all') p.set('vis', opts.vis)
  if (opts.page && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return s ? `/admin/comments?${s}` : '/admin/comments'
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vis?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const visibility = parseVis(sp.vis)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [
    totals,
    byTool,
    byCategory,
    totalRows,
    comments,
    mutedRecent,
    mutedCount,
  ] = await Promise.all([
    neon.neonAdminCommentTotals(),
    neon.neonAdminCommentCountsByTool(80),
    neon.neonAdminCommentCountsVisibleByCategory(),
    neon.neonAdminListCommentsCount({ q, visibility }),
    neon.neonAdminListComments({
      q,
      visibility,
      limit: PAGE_SIZE,
      offset,
    }),
    neon.neonListProfilesCommentMutedRecent(40),
    neon.neonCountProfilesCommentMuted(),
  ])

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const categoryChartData = byCategory.map((c) => ({
    label: c.category_name,
    count: c.count,
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 md:p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">评论管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          检索与隐藏评论、查看统计，以及禁止用户发表评论（禁言仅影响评论，不等同于禁用账号）。
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总评论</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totals.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            含已隐藏
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>前台可见</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700 dark:text-emerald-400">
              {totals.visible}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            未隐藏
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已隐藏</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-700 dark:text-amber-400">
              {totals.hidden}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            管理端可恢复
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>禁言用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {mutedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            不可发新评论
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>有评论的工具数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{byTool.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            下表列出前 80 名
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-1">
        <AdminCommentCategoryChart data={categoryChartData} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>各工具评论数</CardTitle>
          <CardDescription>
            按评论总量降序（含隐藏）；「可见 / 隐藏」为条数拆分
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6">
          {byTool.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              尚无评论数据
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工具名称</TableHead>
                  <TableHead className="text-right w-24">可见</TableHead>
                  <TableHead className="text-right w-24">隐藏</TableHead>
                  <TableHead className="text-right w-24">合计</TableHead>
                  <TableHead className="w-28 text-right">链接</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTool.map((t) => (
                  <TableRow key={t.tool_id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.visible}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">
                      {t.hidden}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.total}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="link" size="sm" className="h-auto p-0">
                        <Link href={toolPublicPath(t.slug)} target="_blank" rel="noreferrer">
                          打开
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>评论列表</CardTitle>
          <CardDescription>
            支持按正文 / 昵称 / 邮箱模糊搜索；可隐藏不当内容（前台立即不展示）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="flex flex-wrap items-end gap-3"
            method="GET"
            action="/admin/comments"
          >
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label htmlFor="q">搜索</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="正文、昵称或邮箱…"
              />
            </div>
            <div className="w-full min-w-[140px] space-y-1.5 sm:w-44">
              <Label htmlFor="vis">状态</Label>
              <select
                id="vis"
                name="vis"
                defaultValue={visibility}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">全部</option>
                <option value="visible">仅可见</option>
                <option value="hidden">仅已隐藏</option>
              </select>
            </div>
            <Button type="submit">筛选</Button>
            {q || visibility !== 'all' ? (
              <Button variant="outline" type="button" asChild>
                <Link href="/admin/comments">清除条件</Link>
              </Button>
            ) : null}
          </form>

          <p className="text-sm text-muted-foreground">
            共 {totalRows} 条
            {totalPages > 1
              ? `，第 ${page} / ${totalPages} 页`
              : ''}
          </p>

          <AdminCommentsTable comments={comments} />

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href={adminCommentsHref({
                      q,
                      vis: visibility,
                      page: page > 1 ? page - 1 : 1,
                    })}
                    aria-disabled={page <= 1}
                    className={
                      page <= 1 ? 'pointer-events-none opacity-40' : undefined
                    }
                  >
                    上一页
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={adminCommentsHref({
                      q,
                      vis: visibility,
                      page: page < totalPages ? page + 1 : totalPages,
                    })}
                    aria-disabled={page >= totalPages}
                    className={
                      page >= totalPages
                        ? 'pointer-events-none opacity-40'
                        : undefined
                    }
                  >
                    下一页
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <AdminCommentMutePanel
            initialMuted={mutedRecent}
            initialMutedCount={mutedCount}
          />
        </CardContent>
      </Card>
    </div>
  )
}
