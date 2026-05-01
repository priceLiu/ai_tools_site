import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { submissionStatusConfig } from '@/components/user-submissions-list'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'
import type { Tool } from '@/lib/types'

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
  const status = submissionStatusConfig[tool.status]
  const StatusIcon = status.icon
  const favMap = await getFavoriteCountsByToolIds(supabase, [tool.id])
  const fav = favMap[tool.id] ?? 0

  return (
    <div className="p-4 md:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
        <Link href="/admin">
          <ArrowLeft className="h-4 w-4" />
          返回审核列表
        </Link>
      </Button>

      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {tool.logo_url ? (
              <Image src={tool.logo_url} alt="" fill className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{tool.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={status.variant}>
                <StatusIcon className={`mr-1 h-3 w-3 ${status.className}`} />
                {status.label}
              </Badge>
              {tool.category ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {tool.category.name}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              阅读量 {tool.view_count ?? 0} · 收藏 {fav}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">官网</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {tool.website_url}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">简介</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-foreground">{tool.description}</p>
            {tool.status === 'rejected' && tool.rejection_reason?.trim() ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                <p className="font-medium">拒绝原因</p>
                <p className="mt-1 whitespace-pre-wrap">{tool.rejection_reason}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {tool.status === 'approved' ? (
          <Button asChild className="mt-6">
            <Link href={`/tool/${tool.slug}`}>打开公开页面</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
