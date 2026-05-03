'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { importToolsFromDocsJsonAction } from '@/app/admin/tools/import-actions'
import { readFileAsTextWithProgress } from '@/lib/image-data-url'
import { Progress } from '@/components/ui/progress'
import type { Category, NavigationMenuTreeNode } from '@/lib/types'
import { idsEqual } from '@/lib/category-tree'
import {
  buildSubmitNavigationTier1List,
  defaultImportTier1PickFromTier1,
  resolvedCategoryIdFromTierPick,
} from '@/lib/submit-category-choices'
import {
  ToolCategoryMenuFields,
  TOOL_CATEGORY_MENU_NONE,
} from '@/components/tool-category-menu-fields'

interface AdminImportToolsFormProps {
  categories: Category[]
  navigation: NavigationMenuTreeNode[]
}

export function AdminImportToolsForm({
  categories,
  navigation,
}: AdminImportToolsFormProps) {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')

  const tier1 = useMemo(
    () => buildSubmitNavigationTier1List(navigation, categories),
    [navigation, categories],
  )

  const defaultPick = useMemo(
    () => defaultImportTier1PickFromTier1(tier1),
    [tier1],
  )

  const [primaryIdx, setPrimaryIdx] = useState(defaultPick.primaryIdx)
  const [leafId, setLeafId] = useState(defaultPick.leafId)

  useEffect(() => {
    setPrimaryIdx(defaultPick.primaryIdx)
    setLeafId(defaultPick.leafId)
  }, [defaultPick.primaryIdx, defaultPick.leafId])

  const handlePrimaryChange = (raw: string) => {
    if (!raw) {
      setPrimaryIdx(-1)
      setLeafId('')
      return
    }
    const idx = Number(raw)
    setPrimaryIdx(idx)
    const row = tier1[idx]
    if (!row) {
      setLeafId('')
      return
    }
    if (row.kind === 'menu_leaf') {
      setLeafId(row.categoryId)
    } else if (row.children.length === 1) {
      setLeafId(row.children[0].categoryId)
    } else {
      setLeafId('')
    }
  }

  const resolvedCategoryId = useMemo(
    () => resolvedCategoryIdFromTierPick(tier1, primaryIdx, leafId),
    [tier1, primaryIdx, leafId],
  )

  useEffect(() => {
    if (primaryIdx < 0 || primaryIdx >= tier1.length) return
    const row = tier1[primaryIdx]
    if (row.kind !== 'menu_group' || row.children.length < 1) return
    const valid = row.children.some((c) => idsEqual(c.categoryId, leafId))
    if (leafId && !valid) {
      setLeafId(row.children[0].categoryId)
    }
  }, [tier1, primaryIdx, leafId])

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
        categoryId: resolvedCategoryId,
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
        <div className="space-y-3 sm:col-span-2">
          <Label>目标分类</Label>
          <p className="text-xs text-muted-foreground">
            与<strong className="font-medium text-foreground">工具提交页</strong>
            一致：选项来自侧栏「菜单管理」结构；折叠分组下请选择具体收录分类（如 AI 办公 →
            AIPPT）。
          </p>
          {tier1.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
              侧栏中尚未配置可导入分类。请在「菜单管理」中为项填写{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                /category/slug
              </code>{' '}
              链接，并为子菜单项绑定对应分类页。
            </p>
          ) : (
            <div className="max-w-2xl space-y-3 rounded-lg border border-border bg-card/50 p-4">
              <ToolCategoryMenuFields
                idPrefix="admin-import"
                tier1={tier1}
                primaryIdx={primaryIdx}
                leafId={leafId}
                onPrimaryChange={(v) => {
                  if (v === TOOL_CATEGORY_MENU_NONE) handlePrimaryChange('')
                  else handlePrimaryChange(v)
                }}
                onLeafChange={(v) =>
                  setLeafId(v === TOOL_CATEGORY_MENU_NONE ? '' : v)
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2 sm:max-w-md">
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
          !resolvedCategoryId ||
          tier1.length === 0
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
