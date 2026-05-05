'use client'

import { useTransition } from 'react'
import { Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { regeneratePublicStaticAction } from '@/app/actions/revalidate-home-tool-bundle'

/**
 * 管理后台「生成静态」按钮。
 * 一键失效首页 / 分类 / 详情 ISR + 重建 `app_kv` 首页快照。
 * 日常审核已通过会走 `revalidateHomeToolBundleAction`（先写快照再失效）；本按钮用于导航/大批量调整或兜底。
 */
export function AdminRegenerateStaticButton({
  className,
}: {
  /** 侧栏等处可传 `w-full justify-start` */
  className?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={cn('shrink-0 gap-1.5', className)}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await regeneratePublicStaticAction()
          if (!r.ok) toast.error(r.message)
          else toast.success(r.message)
        })
      }}
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <Rocket className="h-3.5 w-3.5" />
      )}
      生成静态
    </Button>
  )
}
