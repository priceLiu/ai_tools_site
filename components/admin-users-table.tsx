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
import {
  adminSetProfileAdminAction,
  adminSetProfileDisabledAction,
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

  if (!profiles.length) {
    return (
      <p className="rounded-lg border bg-muted/30 py-10 text-center text-sm text-muted-foreground">
        暂无用户资料
      </p>
    )
  }

  const adminCount = profiles.filter((p) => p.is_admin).length

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">昵称</TableHead>
            <TableHead className="hidden sm:table-cell">用户 ID</TableHead>
            <TableHead className="text-center">管理员</TableHead>
            <TableHead className="text-center">已禁用</TableHead>
            <TableHead className="hidden md:table-cell">注册时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const isSelf = p.id === currentUserId
            const soleAdminLocked = p.is_admin && adminCount <= 1
            return (
              <TableRow key={p.id}>
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
                  <Switch
                    checked={Boolean(p.is_disabled)}
                    disabled={pending === `${p.id}-dis` || isSelf}
                    title={
                      isSelf ? '不能禁用当前登录账号' : undefined
                    }
                    onCheckedChange={(checked) => {
                      if (isSelf && checked) return
                      setPending(`${p.id}-dis`)
                      startTransition(() => {
                        void (async () => {
                          try {
                            await adminSetProfileDisabledAction(p.id, checked)
                            toast.success(
                              checked ? '已禁用该账号' : '已解除禁用',
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
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
