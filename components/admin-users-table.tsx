'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  adminSetProfileAdminAction,
  adminSetProfileDisabledAction,
  adminDeleteUserAction,
} from '@/app/admin/users/actions'

interface AdminUsersTableProps {
  profiles: Profile[]
  currentUserId: string
}

function shortId(id: string) {
  if (!id) return '—'
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`
}

export function AdminUsersTable({
  profiles,
  currentUserId,
}: AdminUsersTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<Profile | null>(null)
  const [disableReason, setDisableReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)

  if (!profiles.length) {
    return (
      <p className="rounded-lg border bg-muted/30 py-10 text-center text-sm text-muted-foreground">
        暂无用户资料
      </p>
    )
  }

  const adminCount = profiles.filter((p) => p.is_admin).length

  const openDisableDialog = (p: Profile) => {
    setDisableReason('')
    setDisableTarget(p)
  }

  const submitDisable = () => {
    const p = disableTarget
    if (!p) return
    const r = disableReason.trim()
    if (r.length < 2) {
      toast.error('请填写至少 2 个字的禁用原因')
      return
    }
    setPending(`${p.id}-dis`)
    startTransition(() => {
      void (async () => {
        try {
          await adminSetProfileDisabledAction(p.id, true, r)
          toast.success('已禁用该账号')
          setDisableTarget(null)
          setDisableReason('')
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '更新失败')
        } finally {
          setPending(null)
        }
      })()
    })
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">注册邮箱</TableHead>
              <TableHead className="min-w-[120px]">昵称</TableHead>
              <TableHead className="hidden sm:table-cell">用户 ID</TableHead>
              <TableHead className="text-center">管理员</TableHead>
              <TableHead className="min-w-[100px] text-center">账号状态</TableHead>
              <TableHead className="hidden min-w-[160px] md:table-cell">
                禁用原因
              </TableHead>
              <TableHead className="hidden md:table-cell">注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const isSelf = p.id === currentUserId
              const soleAdminLocked = p.is_admin && adminCount <= 1
              return (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[200px] truncate text-sm font-mono">
                    {p.registration_email?.trim() ? (
                      p.registration_email.trim()
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.display_name?.trim() || (
                        <span className="text-muted-foreground">未设置昵称</span>
                      )}
                      {isSelf ? (
                        <Badge variant="outline" className="text-xs">
                          当前账号
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {shortId(p.id)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={p.is_admin}
                      disabled={
                        pending === `${p.id}-admin` || soleAdminLocked
                      }
                      title={
                        soleAdminLocked
                          ? '至少保留一名管理员'
                          : undefined
                      }
                      onCheckedChange={(checked) => {
                        if (soleAdminLocked && !checked) {
                          toast.error('至少需要保留一名管理员')
                          return
                        }
                        setPending(`${p.id}-admin`)
                        startTransition(() => {
                          void (async () => {
                            try {
                              await adminSetProfileAdminAction(p.id, checked)
                              toast.success(
                                checked ? '已设为管理员' : '已取消管理员',
                              )
                              router.refresh()
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : '更新失败',
                              )
                            } finally {
                              setPending(null)
                            }
                          })()
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {p.is_disabled ? (
                      <Badge variant="destructive">已禁用</Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground md:table-cell">
                    {p.disabled_reason?.trim() || '—'}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {new Date(p.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-2">
                      {!p.is_disabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={isSelf || pending === `${p.id}-dis`}
                          onClick={() => openDisableDialog(p)}
                        >
                          禁用
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending === `${p.id}-dis`}
                          onClick={() => {
                            setPending(`${p.id}-dis`)
                            startTransition(() => {
                              void (async () => {
                                try {
                                  await adminSetProfileDisabledAction(
                                    p.id,
                                    false,
                                  )
                                  toast.success('已解除禁用')
                                  router.refresh()
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error
                                      ? e.message
                                      : '更新失败',
                                  )
                                } finally {
                                  setPending(null)
                                }
                              })()
                            })
                          }}
                        >
                          解除禁用
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={
                          isSelf ||
                          soleAdminLocked ||
                          pending === `${p.id}-del`
                        }
                        title={
                          soleAdminLocked && p.is_admin
                            ? '需先新增其他管理员'
                            : isSelf
                              ? '不能删除当前账号'
                              : undefined
                        }
                        onClick={() => setDeleteTarget(p)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={disableTarget != null}
        onOpenChange={(o) => {
          if (!o) setDisableTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>禁用账号</DialogTitle>
            <DialogDescription>
              请填写禁用原因（至少 2 个字）。用户将无法登录，已登录会话也会被终止。
            </DialogDescription>
          </DialogHeader>
          {disableTarget ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                目标：
                <span className="font-mono text-foreground">
                  {disableTarget.registration_email ?? shortId(disableTarget.id)}
                </span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="disable-reason">禁用原因</Label>
                <Textarea
                  id="disable-reason"
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="例如：发布违规内容、恶意刷提交…"
                  rows={4}
                  maxLength={500}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisableTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending === `${disableTarget?.id}-dis`}
              onClick={submitDisable}
            >
              确认禁用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除该用户？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>此操作不可恢复。将删除该用户的资料、登录凭证、收藏，以及其提交的全部工具（含评论、标签关联）。</p>
                {deleteTarget ? (
                  <ul className="list-inside list-disc text-foreground">
                    <li>
                      邮箱：
                      <span className="font-mono">
                        {deleteTarget.registration_email ?? '—'}
                      </span>
                    </li>
                    <li>
                      昵称：
                      {deleteTarget.display_name?.trim() || '未设置'}
                    </li>
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending === `${deleteTarget?.id}-del`}
              onClick={(e) => {
                e.preventDefault()
                const t = deleteTarget
                if (!t) return
                setPending(`${t.id}-del`)
                startTransition(() => {
                  void (async () => {
                    try {
                      await adminDeleteUserAction(t.id)
                      toast.success('已删除用户')
                      setDeleteTarget(null)
                      router.refresh()
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : '删除失败',
                      )
                    } finally {
                      setPending(null)
                    }
                  })()
                })
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
