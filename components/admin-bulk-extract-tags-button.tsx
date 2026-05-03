'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { bulkExtractToolTagsAdminAction } from '@/app/actions/tool-tags'

export function AdminBulkExtractTagsButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const run = async () => {
    setNote(null)
    setPending(true)
    try {
      const r = await bulkExtractToolTagsAdminAction()
      if (!r.ok) {
        setNote(r.error ?? '失败')
        return
      }
      setNote(`已处理 ${r.updated} 个工具的标签`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
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
      {note ? (
        <span
          className={
            note.startsWith('已处理')
              ? 'text-xs text-emerald-600 dark:text-emerald-400'
              : 'text-xs text-destructive'
          }
        >
          {note}
        </span>
      ) : null}
    </div>
  )
}
