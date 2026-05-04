'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, XCircle } from 'lucide-react'
import { adminSetToolDisabledAction } from '@/app/actions/database-mutations'

interface AdminDisableToggleButtonProps {
  toolId: string
  initialDisabled: boolean
  /** 与列表「拒绝」同类的红描边按钮；禁用时为绿描边「恢复展示」 */
  layout?: 'toolbar' | 'editor'
}

export function AdminDisableToggleButton({
  toolId,
  initialDisabled,
  layout = 'toolbar',
}: AdminDisableToggleButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [disabled, setDisabled] = useState(initialDisabled)

  const toggle = async () => {
    const next = !disabled
    setDisabled(next)
    const { error } = await adminSetToolDisabledAction(toolId, next)

    if (error) {
      setDisabled(!next)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const size = layout === 'editor' ? 'default' : 'sm'

  if (disabled) {
    return (
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={() => void toggle()}
        disabled={isPending}
        className="gap-1 text-green-600 hover:text-green-700"
      >
        {isPending ? <Spinner className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
        恢复前台展示
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={() => void toggle()}
      disabled={isPending}
      className="gap-1 text-red-600 hover:text-red-700"
    >
      {isPending ? <Spinner className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      禁用
    </Button>
  )
}
