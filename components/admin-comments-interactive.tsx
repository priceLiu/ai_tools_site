'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  adminSearchProfilesForMuteAction,
  adminSetCommentHiddenAction,
  adminSetProfileCommentMuteAction,
} from '@/app/admin/comments/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toolPublicPath } from '@/lib/tool-public-path'
import type { AdminCommentRow, Profile } from '@/lib/types'
import { Ban, EyeOff, RotateCcw, Search } from 'lucide-react'

export function AdminCommentsTable({
  comments,
}: {
  comments: AdminCommentRow[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const toggleHidden = useCallback(
    (row: AdminCommentRow, hidden: boolean) => {
      startTransition(async () => {
        const r = await adminSetCommentHiddenAction({
          commentId: row.id,
          hidden,
          toolSlug: row.tool_slug,
        })
        if (r.error) {
          toast.error(r.error)
          return
        }
        toast.success(hidden ? '已隐藏该评论' : '已恢复显示')
        router.refresh()
      })
    },
    [router],
  )

  if (comments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        没有匹配的评论
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">工具</TableHead>
            <TableHead className="min-w-[100px]">昵称</TableHead>
            <TableHead className="min-w-[160px]">邮箱</TableHead>
            <TableHead className="min-w-[200px]">内容</TableHead>
            <TableHead className="w-36">时间</TableHead>
            <TableHead className="w-28 text-center">状态</TableHead>
            <TableHead className="w-36 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comments.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={toolPublicPath(row.tool_slug)}
                  className="font-medium text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.tool_name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{row.nickname}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.email}
              </TableCell>
              <TableCell className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">
                {row.body.length > 180 ? `${row.body.slice(0, 180)}…` : row.body}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString('zh-CN')}
              </TableCell>
              <TableCell className="text-center">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    row.is_hidden
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100'
                      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
                  )}
                >
                  {row.is_hidden ? '已隐藏' : '可见'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {row.is_hidden ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => toggleHidden(row, false)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-amber-700"
                    onClick={() => toggleHidden(row, true)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    隐藏
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProfileMuteRow({
  p,
  onUpdated,
}: {
  p: Profile
  onUpdated: () => void
}) {
  const muted = p.comment_muted === true
  const [, startTransition] = useTransition()

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {p.registration_email ?? '—'}
      </TableCell>
      <TableCell className="text-sm">{p.display_name ?? '—'}</TableCell>
      <TableCell className="max-w-[220px] text-xs text-muted-foreground">
        {muted ? p.comment_mute_reason ?? '—' : '—'}
      </TableCell>
      <TableCell className="text-center text-sm">
        {muted ? (
          <span className="text-destructive">禁言中</span>
        ) : (
          <span className="text-muted-foreground">正常</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {muted ? (
          <MuteDialogButton
            profile={p}
            nextMuted={false}
            label="解除禁言"
            onDone={onUpdated}
          />
        ) : (
          <MuteDialogButton
            profile={p}
            nextMuted={true}
            label="禁言"
            variant="destructive"
            onDone={onUpdated}
          />
        )}
      </TableCell>
    </TableRow>
  )
}

function MuteDialogButton({
  profile,
  nextMuted,
  label,
  variant = 'outline',
  onDone,
}: {
  profile: Profile
  nextMuted: boolean
  label: string
  variant?: 'outline' | 'destructive' | 'secondary'
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const r = await adminSetProfileCommentMuteAction({
        profileId: profile.id,
        muted: nextMuted,
        reason: nextMuted ? reason.trim() || null : null,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(nextMuted ? '已禁止该用户发表评论' : '已解除评论禁言')
      setOpen(false)
      setReason('')
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={variant} className="gap-1">
          {nextMuted ? (
            <Ban className="h-3.5 w-3.5" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{nextMuted ? '禁止发表评论' : '解除禁言'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {profile.registration_email ?? profile.id}
        </p>
        {nextMuted ? (
          <div className="space-y-2">
            <Label htmlFor="mute-reason">原因（选填，站内记录）</Label>
            <Textarea
              id="mute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：垃圾广告、人身攻击…"
              rows={3}
              maxLength={500}
            />
          </div>
        ) : (
          <p className="text-sm">确认解除后，该用户可再次在工具详情页发表评论。</p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminCommentMutePanel({
  initialMuted,
  initialMutedCount,
}: {
  initialMuted: Profile[]
  initialMutedCount: number
}) {
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  const runSearch = useCallback(() => {
    const q = searchQ.trim()
    if (q.length < 2) {
      toast.message('请输入至少 2 个字符')
      return
    }
    setSearching(true)
    void (async () => {
      const r = await adminSearchProfilesForMuteAction(q)
      setSearching(false)
      if ('error' in r && r.error) {
        toast.error(r.error)
        setSearchHits([])
        return
      }
      if ('profiles' in r) {
        setSearchHits(r.profiles)
        if (r.profiles.length === 0) {
          toast.message('未找到匹配用户')
        }
      }
    })()
  }, [searchQ])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">用户禁言</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          被禁言的用户仍可浏览站点，但无法在工具详情页提交新评论。按注册邮箱或昵称搜索。
        </p>
        <p className="mt-2 text-sm">
          当前禁言用户（共 <strong>{initialMutedCount}</strong> 人）
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="mute-search" className="sr-only">
            搜索用户
          </Label>
          <Input
            id="mute-search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="邮箱或昵称，至少 2 字"
          />
        </div>
        <Button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="gap-1"
        >
          <Search className="h-4 w-4" />
          搜索
        </Button>
      </div>

      {searchHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">搜索结果</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>昵称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchHits.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.registration_email ?? '—'}
                    </TableCell>
                    <TableCell>{p.display_name ?? '—'}</TableCell>
                    <TableCell>
                      {p.comment_muted ? (
                        <span className="text-destructive">禁言中</span>
                      ) : (
                        '正常'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.comment_muted ? (
                        <MuteDialogButton
                          profile={p}
                          nextMuted={false}
                          label="解除禁言"
                          onDone={() => {
                            refresh()
                            setSearchHits((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      comment_muted: false,
                                      comment_mute_reason: null,
                                    }
                                  : x,
                              ),
                            )
                          }}
                        />
                      ) : (
                        <MuteDialogButton
                          profile={p}
                          nextMuted={true}
                          label="禁言"
                          variant="destructive"
                          onDone={() => {
                            refresh()
                            setSearchHits((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      comment_muted: true,
                                    }
                                  : x,
                              ),
                            )
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          当前处于禁言状态的用户（最多 40 条；按账号注册时间新→旧排序）
        </h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>昵称</TableHead>
                <TableHead>原因</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialMuted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    暂无禁言用户
                  </TableCell>
                </TableRow>
              ) : (
                initialMuted.map((p) => (
                  <ProfileMuteRow key={p.id} p={p} onUpdated={refresh} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
