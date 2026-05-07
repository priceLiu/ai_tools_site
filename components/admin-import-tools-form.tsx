'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import {
  batchSuggestTagsForImportAction,
  importDocsToolsItemsAction,
} from '@/app/admin/tools/import-actions'
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
import {
  parseDocsToolsJson,
  type DocsToolJsonItem,
} from '@/lib/parse-docs-tools-json'

const MATCH_BATCH_SIZE = 12
const IMPORT_BATCH_SIZE = 3

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
  const [autoMatchTags, setAutoMatchTags] = useState(true)

  const [validatedItems, setValidatedItems] = useState<DocsToolJsonItem[] | null>(
    null,
  )
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  )

  const [tagPreview, setTagPreview] = useState<Record<number, string[]>>({})
  const [matchPhase, setMatchPhase] = useState<'idle' | 'running' | 'done'>(
    'idle',
  )
  const [matchDoneCount, setMatchDoneCount] = useState(0)
  const [matchTotal, setMatchTotal] = useState(0)
  const [matchCurrentName, setMatchCurrentName] = useState('')
  const [matchLines, setMatchLines] = useState<string[]>([])

  const [importPhase, setImportPhase] = useState<'idle' | 'running' | 'done'>(
    'idle',
  )
  const [importDoneCount, setImportDoneCount] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importCurrentName, setImportCurrentName] = useState('')
  const [importLines, setImportLines] = useState<string[]>([])

  const [bottomLog, setBottomLog] = useState<string>('')

  const [isBusy, startTransition] = useTransition()
  const [pickedFileName, setPickedFileName] = useState<string | null>(null)
  const [fileReadProgress, setFileReadProgress] = useState<
    number | 'indeterminate' | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetDerivedFromJson() {
    setValidatedItems(null)
    setValidationMessage(null)
    setTagPreview({})
    setMatchPhase('idle')
    setMatchDoneCount(0)
    setMatchTotal(0)
    setMatchCurrentName('')
    setMatchLines([])
    setImportPhase('idle')
    setImportDoneCount(0)
    setImportTotal(0)
    setImportCurrentName('')
    setImportLines([])
    setBottomLog('')
  }

  const onJsonFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPickedFileName(file.name)
    setFileReadProgress(0)
    resetDerivedFromJson()
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
          setValidationMessage('文件为空')
        }
      } catch {
        setValidationMessage('读取文件失败')
        setPickedFileName(null)
        setJsonText('')
      } finally {
        setFileReadProgress(null)
      }
    })()
  }

  const validateStructure = () => {
    let raw: unknown
    try {
      raw = JSON.parse(jsonText) as unknown
    } catch {
      setValidationMessage('JSON 语法错误：无法解析')
      setValidatedItems(null)
      return
    }
    const parsed = parseDocsToolsJson(raw)
    if (!parsed.ok) {
      setValidationMessage(parsed.error)
      setValidatedItems(null)
      return
    }
    if (parsed.items.length === 0) {
      setValidationMessage('数组为空，没有可导入条目')
      setValidatedItems(null)
      return
    }
    setValidatedItems(parsed.items)
    setValidationMessage(`结构校验通过，共 ${parsed.items.length} 条`)
    setTagPreview({})
    setMatchPhase('idle')
    setMatchLines([])
    setImportPhase('idle')
    setImportLines([])
    setBottomLog('')
  }

  useEffect(() => {
    if (!autoMatchTags) {
      setMatchPhase('idle')
      setTagPreview({})
      setMatchLines([])
      setMatchDoneCount(0)
      setMatchTotal(0)
    }
  }, [autoMatchTags])

  const runMatchPreview = () => {
    if (!validatedItems?.length || !resolvedCategoryId) return
    setMatchPhase('running')
    setMatchTotal(validatedItems.length)
    setMatchDoneCount(0)
    setMatchLines([])
    setBottomLog('')

    startTransition(async () => {
      const preview: Record<number, string[]> = {}
      const lines: string[] = []
      const total = validatedItems.length
      let offset = 0

      while (offset < total) {
        const slice = validatedItems.slice(offset, offset + MATCH_BATCH_SIZE)
        const res = await batchSuggestTagsForImportAction({
          items: slice,
          categoryId: resolvedCategoryId,
          baseIndex: offset,
        })
        if (!res.ok || !res.rows) {
          setMatchPhase('idle')
          setValidationMessage(res.error ?? '标签匹配失败')
          return
        }
        for (const row of res.rows) {
          preview[row.index] = row.tags
          const tagStr = row.tags.length ? row.tags.join('、') : '（无）'
          lines.push(`[${row.index + 1}/${total}] ${row.name} → ${tagStr}`)
          setMatchCurrentName(row.name)
        }
        offset += slice.length
        setMatchDoneCount(offset)
        setMatchLines([...lines])
        setTagPreview({ ...preview })
      }

      setMatchPhase('done')
      setMatchCurrentName('')
    })
  }

  const runImport = () => {
    if (!validatedItems?.length || !resolvedCategoryId) return
    if (autoMatchTags && matchPhase !== 'done') return

    setImportPhase('running')
    setImportTotal(validatedItems.length)
    setImportDoneCount(0)
    setImportLines([])
    setBottomLog('')

    startTransition(async () => {
      const total = validatedItems.length
      let offset = 0
      const summaryLines: string[] = []
      let importedTotal = 0

      while (offset < total) {
        const slice = validatedItems.slice(offset, offset + IMPORT_BATCH_SIZE)
        const tagByRelativeIndex: Record<string, string[]> = {}
        if (autoMatchTags && matchPhase === 'done') {
          for (let i = 0; i < slice.length; i++) {
            const g = offset + i
            const tags = tagPreview[g]
            if (tags !== undefined) {
              tagByRelativeIndex[String(i)] = tags
            }
          }
        }

        const hasExplicitTags = Object.keys(tagByRelativeIndex).length > 0

        for (const it of slice) {
          setImportCurrentName(it.name)
        }

        const res = await importDocsToolsItemsAction({
          items: slice,
          categoryId: resolvedCategoryId,
          initialStatus,
          tagByRelativeIndex: hasExplicitTags ? tagByRelativeIndex : undefined,
          deferBundleRevalidate: offset + slice.length < total,
        })

        if (!res.ok) {
          setImportPhase('idle')
          setBottomLog(res.error ?? '导入中断')
          return
        }

        offset += slice.length
        setImportDoneCount(offset)
        importedTotal += res.imported ?? 0

        for (const r of res.results ?? []) {
          const extra = r.message ? ` — ${r.message}` : ''
          summaryLines.push(`${r.ok ? '✓' : '✗'} ${r.name}${extra}`)
        }
        setImportLines([...summaryLines])
      }

      setImportPhase('done')
      setImportCurrentName('')
      setBottomLog(
        `导入结束：写入成功 ${importedTotal} / ${total} 条（部分行可能因重复等跳过，见下列明细）`,
      )
      router.refresh()
    })
  }

  const matchProgressPct =
    matchTotal > 0 ? Math.round((matchDoneCount / matchTotal) * 100) : 0
  const importProgressPct =
    importTotal > 0 ? Math.round((importDoneCount / importTotal) * 100) : 0

  const canMatch =
    validatedItems &&
    validatedItems.length > 0 &&
    !!resolvedCategoryId &&
    autoMatchTags &&
    matchPhase !== 'running' &&
    !isBusy

  const canImport =
    validatedItems &&
    validatedItems.length > 0 &&
    !!resolvedCategoryId &&
    tier1.length > 0 &&
    (!autoMatchTags || matchPhase === 'done') &&
    importPhase !== 'running' &&
    !isBusy

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>JSON 数据（与 docs/data.json 相同结构）</Label>
        <p className="text-xs text-muted-foreground">
          每条含 name、logo_url（可选）、introduction（Markdown）、official_url。
          可先<strong className="font-medium text-foreground">选择 JSON 文件</strong>
          或粘贴；请先点<strong className="font-medium text-foreground">校验 JSON 结构</strong>
          。若开启「自动匹配标签」，匹配完成后再导入。
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
            resetDerivedFromJson()
          }}
          placeholder={`[\n  {\n    "name": "示例工具",\n    "logo_url": "https://example.com/favicon.ico",\n    "introduction": "## 介绍\\n...",\n    "official_url": "https://example.com"\n  }\n]`}
          rows={14}
          className="font-mono text-xs md:text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={validateStructure}
            disabled={!jsonText.trim() || isBusy}
          >
            校验 JSON 结构
          </Button>
        </div>
        {validationMessage ? (
          <p
            className={`text-sm ${validatedItems ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}
          >
            {validationMessage}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 sm:col-span-2">
          <Label>目标分类</Label>
          <p className="text-xs text-muted-foreground">
            与<strong className="font-medium text-foreground">工具提交页</strong>
            一致：选项来自侧栏「菜单管理」结构。
          </p>
          {tier1.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
              侧栏中尚未配置可导入分类。请在「菜单管理」中为项填写{' '}
              <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                /category/slug
              </code>{' '}
              链接。
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

          <div className="max-w-2xl space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="admin-import-auto-tags" className="text-sm">
                  自动匹配标签
                </Label>
                <p className="text-xs text-muted-foreground">
                  开启后须先「预览标签匹配」再导入；关闭则导入时在服务端按每条即时计算标签（无预览进度）。
                </p>
              </div>
              <Switch
                id="admin-import-auto-tags"
                checked={autoMatchTags}
                disabled={isBusy || matchPhase === 'running'}
                onCheckedChange={(v) => setAutoMatchTags(v === true)}
              />
            </div>

            {autoMatchTags ? (
              <div className="space-y-2 border-t border-border/80 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={runMatchPreview}
                  disabled={!canMatch}
                >
                  {matchPhase === 'running'
                    ? '匹配中…'
                    : matchPhase === 'done'
                      ? '重新匹配标签'
                      : '预览标签匹配'}
                </Button>
                {matchPhase !== 'idle' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        匹配进度 {matchDoneCount}/{matchTotal || (validatedItems?.length ?? 0)}
                        {matchCurrentName ? ` · ${matchCurrentName}` : ''}
                      </span>
                      <span>{matchProgressPct}%</span>
                    </div>
                    <Progress
                      value={
                        matchPhase === 'running' ? matchProgressPct : 100
                      }
                      className={matchPhase === 'running' ? '' : 'opacity-90'}
                    />
                    {matchLines.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {matchLines.slice(-80).map((ln, i) => (
                          <div key={`${i}-${ln.slice(0, 12)}`}>{ln}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
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

      <div className="space-y-3">
        <Button
          type="button"
          onClick={runImport}
          disabled={!canImport}
        >
          {importPhase === 'running' ? '导入中…' : '开始导入'}
        </Button>

        {importPhase !== 'idle' ? (
          <div className="max-w-2xl space-y-2 rounded-lg border border-border bg-card/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">导入进度</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {importDoneCount}/{importTotal || (validatedItems?.length ?? 0)}
                {importCurrentName ? ` · ${importCurrentName}` : ''}
              </span>
              <span>{importProgressPct}%</span>
            </div>
            <Progress
              value={importPhase === 'running' ? importProgressPct : 100}
            />
            {importLines.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed">
                {importLines.map((ln, i) => (
                  <div key={`${i}-${ln.slice(0, 16)}`}>{ln}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {bottomLog ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            摘要
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">
            {bottomLog}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
