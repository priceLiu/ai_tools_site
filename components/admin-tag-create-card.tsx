'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { adminCreateTagAction } from '@/app/admin/tags/actions'
import type { TagCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'

export function AdminTagCreateCard({
  tagCategories,
}: {
  tagCategories: TagCategory[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(
    () => tagCategories[0]?.id ?? '',
  )
  const [isCurated, setIsCurated] = useState(true)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const submit = () => {
    setMessage(null)
    const n = name.normalize('NFKC').trim()
    if (!n) {
      setMessage('请输入标签名称')
      return
    }
    if (!categoryId) {
      setMessage('请选择场景分类')
      return
    }
    startTransition(async () => {
      const r = await adminCreateTagAction({
        name: n,
        tagCategoryId: categoryId,
        isCurated,
      })
      if (!r.ok) {
        setMessage(r.error ?? '创建失败')
        return
      }
      setName('')
      setMessage(`已创建标签，id=${r.id}`)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">新建标签（可控词表）</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          访客提交工具时仅能使用「自动提取标签」，词表自此入口与清洗流程扩展。名称在同一库内唯一；须归属某一「场景分类」。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 space-y-1.5 sm:max-w-[200px]">
          <Label htmlFor="new-tag-name" className="text-xs">
            标签名称
          </Label>
          <Input
            id="new-tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：短视频脚本"
            disabled={pending}
          />
        </div>
        <div className="flex-1 space-y-1.5 sm:max-w-[220px]">
          <Label htmlFor="new-tag-cat" className="text-xs">
            场景分类
          </Label>
          <select
            id="new-tag-cat"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={categoryId}
            disabled={pending || tagCategories.length === 0}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {tagCategories.length === 0 ? (
              <option value="">无场景数据</option>
            ) : null}
            {tagCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_disabled ? '（已禁用）' : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isCurated}
            disabled={pending}
            onCheckedChange={(v) => setIsCurated(v === true)}
          />
          标为 curated
        </label>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={pending}
          className="sm:shrink-0"
        >
          {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
          创建
        </Button>
        {message ? (
          <p className="w-full text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
