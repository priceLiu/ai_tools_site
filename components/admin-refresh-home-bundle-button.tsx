'use client'

import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { forceRefreshHomeBundleSnapshotAdminAction } from '@/app/actions/revalidate-home-tool-bundle'

export function AdminRefreshHomeBundleButton({
  className,
}: {
  /** 侧栏等处可传 `w-full justify-start` */
  className?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('shrink-0 gap-1.5', className)}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await forceRefreshHomeBundleSnapshotAdminAction()
          if (!r.ok) toast.error(r.message)
          else toast.success(r.message)
        })
      }}
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      刷新首页缓存
    </Button>
  )
}
