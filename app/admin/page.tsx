import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminToolActions } from '@/components/admin-tool-actions'
import { ToolListRowCard } from '@/components/tool-list-row-card'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'
import { Shield, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import type { Tool } from '@/lib/types'

export const metadata = {
  title: '管理后台 - AI工具集',
}

function adminDetailHref(tool: Tool) {
  if (tool.status === 'approved') return `/tool/${tool.slug}`
  return `/admin/tools/${tool.id}`
}

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: pendingTools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: approvedTools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: rejectedTools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(50)

  const pending = (pendingTools as Tool[]) || []
  const approved = (approvedTools as Tool[]) || []
  const rejected = (rejectedTools as Tool[]) || []

  const allIds = [...pending, ...approved, ...rejected].map((t) => t.id)
  const favCounts = await getFavoriteCountsByToolIds(supabase, [...new Set(allIds)])

  const renderCard = (tool: Tool, showActions: boolean) => {
    const href = adminDetailHref(tool)
    return (
      <ToolListRowCard
        key={tool.id}
        tool={tool}
        logoHref={href}
        titleHref={href}
        favoritesCount={favCounts[tool.id] ?? 0}
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
              {showActions ? <AdminToolActions toolId={tool.id} /> : null}
            </div>
          </div>
        }
      />
    )
  }

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
                <p className="text-2xl font-bold text-foreground">{pending.length}</p>
                <p className="text-sm text-muted-foreground">待审核</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{approved.length}</p>
                <p className="text-sm text-muted-foreground">已通过（最近 50 条）</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rejected.length}</p>
                <p className="text-sm text-muted-foreground">未通过（最近 50 条）</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="mb-6 h-auto flex-wrap gap-1">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              待审核 ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              已通过 ({approved.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              未通过 ({rejected.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pending.length > 0 ? (
              <div className="space-y-4">{pending.map((t) => renderCard(t, true))}</div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                暂无待审核的工具
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved">
            {approved.length > 0 ? (
              <div className="space-y-4">{approved.map((t) => renderCard(t, false))}</div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                暂无已通过的工具
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected">
            {rejected.length > 0 ? (
              <div className="space-y-4">{rejected.map((t) => renderCard(t, false))}</div>
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
