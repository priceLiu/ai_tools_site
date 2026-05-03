'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tags } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { bulkExtractToolTagsAdminAction } from '@/app/actions/tool-tags'

export function AdminBulkExtractTagsButton({
  className,
}: {
  className?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const run = async () => {
    setPending(true)
    try {
      const r = await bulkExtractToolTagsAdminAction()
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(`已处理 ${r.updated} 个工具的标签`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('shrink-0 gap-1.5', className)}
      disabled={pending}
      onClick={() => void run()}
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <Tags className="h-3.5 w-3.5" />
      )}
      一键提取全部标签
    </Button>
  )
}
