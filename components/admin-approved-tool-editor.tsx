'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AdminFeaturedToggle } from '@/components/admin-featured-toggle'
import { AdminDisableToggleButton } from '@/components/admin-disable-toggle-button'
import { updateApprovedToolAdminAction } from '@/app/admin/tools/actions'
import { LISTING_DESCRIPTION_MAX } from '@/lib/introduction-format'

interface AdminApprovedToolEditorProps {
  toolId: string
  initialName: string
  initialDescription: string
  initialWebsiteUrl: string
  initialDisabled: boolean
  initialFeatured: boolean
}

export function AdminApprovedToolEditor({
  toolId,
  initialName,
  initialDescription,
  initialWebsiteUrl,
  initialDisabled,
  initialFeatured,
}: AdminApprovedToolEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setMessage(null)
    const r = await updateApprovedToolAdminAction({
      toolId,
      name,
      description,
      website_url: websiteUrl,
    })
    if (r.error) {
      setMessage(r.error)
      return
    }
    setMessage('已保存')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">编辑公开信息</h3>
      <p className="text-xs text-muted-foreground">
        「禁用 / 设为热门」立即生效；名称、概述描述与官网需点下方保存。
      </p>

      {message ? (
        <p
          className={
            message === '已保存'
              ? 'text-sm text-emerald-600 dark:text-emerald-400'
              : 'text-sm text-destructive'
          }
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-name-${toolId}`}>名称</Label>
        <Input
          id={`admin-tool-name-${toolId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-desc-${toolId}`}>概述描述</Label>
        <Textarea
          id={`admin-tool-desc-${toolId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={LISTING_DESCRIPTION_MAX}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-url-${toolId}`}>官网</Label>
        <Input
          id={`admin-tool-url-${toolId}`}
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <AdminFeaturedToggle
          toolId={toolId}
          initialFeatured={initialFeatured}
          appearance="toolbar"
          buttonSize="default"
        />
        <AdminDisableToggleButton
          toolId={toolId}
          initialDisabled={initialDisabled}
          layout="editor"
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 min-w-[9rem] px-8 text-base"
        disabled={isPending}
        onClick={() => void save()}
      >
        {isPending ? <Spinner className="mr-2 h-5 w-5" /> : null}
        保存修改
      </Button>
    </div>
  )
}
