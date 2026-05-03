'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { importToolsFromDocsJsonAction } from '@/app/admin/tools/import-actions'
import { readFileAsTextWithProgress } from '@/lib/image-data-url'
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/lib/types'

type CategoryOption = Pick<
  Category,
  'id' | 'name' | 'slug' | 'parent_id' | 'sort_order'
>

interface AdminImportToolsFormProps {
  categories: CategoryOption[]
}

export function AdminImportToolsForm({ categories }: AdminImportToolsFormProps) {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')
  const [categoryId, setCategoryId] = useState<string>(
    categories[0]?.id ?? '',
  )
  const [initialStatus, setInitialStatus] = useState<'approved' | 'pending'>(
    'approved',
  )
  const [log, setLog] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [pickedFileName, setPickedFileName] = useState<string | null>(null)
  const [fileReadProgress, setFileReadProgress] = useState<
    number | 'indeterminate' | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onJsonFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPickedFileName(file.name)
    setFileReadProgress(0)
    setLog('')
    void (async () => {
      try {
        const text = await readFileAsTextWithProgress(file, {
          onProgress: (p) => {
            if (p === null) setFileReadProgress('indeterminate')
            else setFileReadProgress(p)
          },
        })
        setJsonText(text)
        if (!text.trim()) {
          setLog('文件为空')
        } else {
          setLog('')
        }
      } catch {
        setLog('读取文件失败')
        setPickedFileName(null)
        setJsonText('')
      } finally {
        setFileReadProgress(null)
      }
    })()
  }

  const runImport = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText) as unknown
    } catch {
      setLog('JSON 解析失败：请检查格式是否为数组')
      return
    }

    setLog('导入中…')
    startTransition(async () => {
      const res = await importToolsFromDocsJsonAction({
        rawJson: parsed,
        categoryId,
        initialStatus,
      })
      if (!res.ok) {
        setLog(res.error ?? '导入失败')
        return
      }
      const lines: string[] = []
      lines.push(`完成：成功 ${res.imported ?? 0} 条`)
      for (const r of res.results ?? []) {
        const extra = r.message ? ` — ${r.message}` : ''
        lines.push(`${r.ok ? '✓' : '✗'} ${r.name}${extra}`)
      }
      setLog(lines.join('\n'))
      router.refresh()
    })
  }

  const sortedCats = [...categories].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>JSON 数据（与 docs/data.json 相同结构）</Label>
        <p className="text-xs text-muted-foreground">
          每条含 name、logo_url（http(s) 将下载并转为 base64 写入 logo_url）、
          introduction（Markdown）、official_url（写入官网 website_url）。列表摘要
          description 由 introduction 自动截取生成。可先{' '}
          <strong className="font-medium text-foreground">选择 JSON 文件</strong>
          ，或直接在下方文本框粘贴。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/json"
            className="sr-only"
            onChange={onJsonFileSelected}
            aria-label="选择 JSON 文件"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            选择 JSON 文件
          </Button>
          {pickedFileName ? (
            <span className="text-xs text-muted-foreground">
              已载入：{pickedFileName}
            </span>
          ) : null}
        </div>
        {fileReadProgress !== null ? (
          <div className="max-w-md space-y-1">
            <Progress
              value={
                fileReadProgress === 'indeterminate'
                  ? undefined
                  : fileReadProgress
              }
              className={
                fileReadProgress === 'indeterminate' ? 'animate-pulse' : ''
              }
            />
            <p className="text-xs text-muted-foreground">
              {fileReadProgress === 'indeterminate'
                ? '读取中…'
                : `读取 ${fileReadProgress}%`}
            </p>
          </div>
        ) : null}
        <Textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value)
            setPickedFileName(null)
          }}
          placeholder={`[\n  {\n    "name": "示例工具",\n    "logo_url": "https://example.com/favicon.ico",\n    "introduction": "## 介绍\\n...",\n    "official_url": "https://example.com"\n  }\n]`}
          rows={14}
          className="font-mono text-xs md:text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>目标分类</Label>
          <Select
            value={categoryId || undefined}
            onValueChange={setCategoryId}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              {sortedCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.slug ? `（${c.slug}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>导入后状态</Label>
          <RadioGroup
            value={initialStatus}
            onValueChange={(v) =>
              setInitialStatus(v === 'pending' ? 'pending' : 'approved')
            }
            className="flex flex-col gap-2 pt-1"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="approved" id="st-approved" />
              已通过（立即上首页，若量大请注意缓存）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="pending" id="st-pending" />
              审核中（需后台再审核）
            </label>
          </RadioGroup>
        </div>
      </div>

      <Button
        type="button"
        onClick={runImport}
        disabled={
          isPending ||
          !jsonText.trim() ||
          !categoryId ||
          sortedCats.length === 0
        }
      >
        {isPending ? '导入中…' : '开始导入'}
      </Button>

      {log ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            结果
          </p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
            {log}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
