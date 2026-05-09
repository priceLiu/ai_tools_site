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
import { Textarea } from '@/components/ui/textarea'
import { PasswordInput } from '@/components/password-input'
import { Label } from '@/components/ui/label'
import {
  adminSetProfileAdminAction,
  adminSetProfileDisabledAction,
  adminSetPortalDisabledByAdminAction,
  adminResetUserPasswordAction,
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
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)
  const [resetPw1, setResetPw1] = useState('')
  const [resetPw2, setResetPw2] = useState('')

  const canResetPassword = (p: Profile) =>
    Boolean(p.registration_email?.trim())

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
              <TableHead className="min-w-[100px] text-center">
                关闭门户
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
                  <TableCell className="text-center">
                    <Switch
                      checked={p.portal_disabled_by_admin === true}
                      disabled={
                        p.is_disabled === true ||
                        pending === `${p.id}-portal-off`
                      }
                      title="强制关闭个人主页门户（用户退回「个人信息」入口）"
                      onCheckedChange={(checked) => {
                        setPending(`${p.id}-portal-off`)
                        startTransition(() => {
                          void (async () => {
                            try {
                              await adminSetPortalDisabledByAdminAction(
                                p.id,
                                checked,
                              )
                              toast.success(
                                checked ? '已强制关闭门户' : '已允许门户',
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
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {new Date(p.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-2">
                      {canResetPassword(p) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending === `${p.id}-pw`}
                          title="无需旧密码；适用于尚未接入邮箱/手机找回的场景"
                          onClick={() => {
                            setResetPw1('')
                            setResetPw2('')
                            setResetTarget(p)
                          }}
                        >
                          重置密码
                        </Button>
                      ) : null}
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

      <Dialog
        open={resetTarget != null}
        onOpenChange={(o) => {
          if (!o) setResetTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置登录密码</DialogTitle>
            <DialogDescription>
              直接写入新密码哈希，用户下次登录请使用新密码。无需旧密码。
            </DialogDescription>
          </DialogHeader>
          {resetTarget ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                账号：
                <span className="font-mono text-foreground">
                  {resetTarget.registration_email ?? shortId(resetTarget.id)}
                </span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-reset-pw1">新密码</Label>
                <PasswordInput
                  id="admin-reset-pw1"
                  autoComplete="new-password"
                  value={resetPw1}
                  onChange={(e) => setResetPw1(e.target.value)}
                  placeholder="至少 6 位"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-reset-pw2">确认新密码</Label>
                <PasswordInput
                  id="admin-reset-pw2"
                  autoComplete="new-password"
                  value={resetPw2}
                  onChange={(e) => setResetPw2(e.target.value)}
                  minLength={6}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                pending === `${resetTarget?.id}-pw` || resetTarget == null
              }
              onClick={() => {
                const t = resetTarget
                if (!t) return
                const a = resetPw1.trim()
                const b = resetPw2.trim()
                if (a.length < 6) {
                  toast.error('新密码至少 6 位')
                  return
                }
                if (a !== b) {
                  toast.error('两次输入的新密码不一致')
                  return
                }
                setPending(`${t.id}-pw`)
                startTransition(() => {
                  void (async () => {
                    try {
                      await adminResetUserPasswordAction(t.id, a)
                      toast.success('密码已重置')
                      setResetTarget(null)
                      setResetPw1('')
                      setResetPw2('')
                      router.refresh()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : '重置失败')
                    } finally {
                      setPending(null)
                    }
                  })()
                })
              }}
            >
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
