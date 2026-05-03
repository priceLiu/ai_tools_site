'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { forceRefreshHomeBundleSnapshotAdminAction } from '@/app/actions/revalidate-home-tool-bundle'

export function AdminRefreshHomeBundleButton() {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          startTransition(async () => {
            const r = await forceRefreshHomeBundleSnapshotAdminAction()
            setMsg(r.message)
          })
        }}
      >
        {pending ? (
          <Spinner className="mr-2 h-4 w-4" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        刷新首页缓存
      </Button>
      {msg ? (
        <p
          className={
            msg.startsWith('未') && (msg.includes('登录') || msg.includes('权限'))
              ? 'text-xs text-red-600'
              : 'text-xs text-muted-foreground'
          }
        >
          {msg}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          写入 Supabase Storage 快照；分类/工具若在库里直接改动可点此同步。
        </p>
      )}
    </div>
  )
}
