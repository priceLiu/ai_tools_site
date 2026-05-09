'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  adminApproveShowcaseAction,
  adminRejectShowcaseAction,
  adminRevokeShowcaseAction,
} from '@/app/admin/showcases/actions'

function slugSuggestion(title: string): string {
  const t = title.trim().toLowerCase()
  const s = t
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return s.length >= 2 ? s : ''
}

export function AdminShowcasesPanel({
  pending,
  approved,
}: {
  pending: Profile[]
  approved: {
    profileId: string
    slug: string
    title: string
    revoke_requested_at: string | null
  }[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [slugByProfile, setSlugByProfile] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        pending.map((p) => [
          p.id,
          slugSuggestion(p.showcase_title ?? '') || `author-${p.id.slice(0, 8)}`,
        ]),
      ),
  )
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  const approve = (p: Profile) => {
    const slug = (slugByProfile[p.id] ?? '').trim()
    if (slug.length < 2) {
      toast.error('请填写至少 2 个字符的 URL slug')
      return
    }
    startTransition(() => {
      void (async () => {
        try {
          await adminApproveShowcaseAction({ profileId: p.id, slug })
          toast.success('已通过并发布')
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '操作失败')
        }
      })()
    })
  }

  const reject = (p: Profile) => {
    const reason = (rejectReason[p.id] ?? '').trim()
    if (reason.length < 2) {
      toast.error('驳回原因至少 2 个字')
      return
    }
    startTransition(() => {
      void (async () => {
        try {
          await adminRejectShowcaseAction({ profileId: p.id, reason })
          toast.success('已驳回')
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '操作失败')
        }
      })()
    })
  }

  const revoke = (profileId: string, slug: string) => {
    if (
      !confirm(
        `确认撤销公开发布？页面 /excellent-ai-solutions/${slug} 将下架。`,
      )
    ) {
      return
    }
    startTransition(() => {
      void (async () => {
        try {
          await adminRevokeShowcaseAction(profileId)
          toast.success('已撤销公开发布')
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '操作失败')
        }
      })()
    })
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          待审核申请
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            暂无待审核提交
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>标题 / 简介</TableHead>
                  <TableHead className="min-w-[140px]">URL slug</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[160px] align-top text-xs">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {p.registration_email ?? p.id.slice(0, 8)}
                      </div>
                      <div>{p.display_name ?? '—'}</div>
                    </TableCell>
                    <TableCell className="max-w-[320px] align-top text-sm">
                      <p className="font-medium">{p.showcase_title ?? '—'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.showcase_summary ?? ''}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Label className="sr-only" htmlFor={`slug-${p.id}`}>
                        slug
                      </Label>
                      <Input
                        id={`slug-${p.id}`}
                        value={slugByProfile[p.id] ?? ''}
                        onChange={(e) =>
                          setSlugByProfile((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                      <Textarea
                        className="mt-2 min-h-[72px] text-xs"
                        placeholder="驳回原因（驳回时必填）"
                        value={rejectReason[p.id] ?? ''}
                        onChange={(e) =>
                          setRejectReason((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="space-y-2 align-top text-right">
                      <Button size="sm" onClick={() => approve(p)}>
                        同意发布
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reject(p)}
                      >
                        驳回
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          已发布（可撤销）
        </h2>
        {approved.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            暂无已发布条目
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>slug</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approved.map((row) => (
                  <TableRow key={row.profileId}>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.title}</span>
                        {row.revoke_requested_at ? (
                          <Badge variant="destructive" className="text-[10px]">
                            用户请求撤销
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      /excellent-ai-solutions/{row.slug}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revoke(row.profileId, row.slug)}
                      >
                        撤销发布
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
