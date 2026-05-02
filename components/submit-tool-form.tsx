'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Upload, X, ExternalLink } from 'lucide-react'
import { idsEqual } from '@/lib/category-tree'
import { buildSubmitNavigationTier1List } from '@/lib/submit-category-choices'
import {
  excerptForListing,
  INTRO_LIMIT_PLAIN,
  INTRO_LIMIT_RICH,
  LISTING_DESCRIPTION_MAX,
  normalizeIntroductionFormat,
  type IntroductionFormat,
} from '@/lib/introduction-format'
import { fileToImageDataUrl } from '@/lib/image-data-url'
import { toolPublicPath } from '@/lib/tool-public-path'
import { ToolDetailView } from '@/components/tool-detail-view'
import { Badge } from '@/components/ui/badge'
import type { Category, NavigationMenuTreeNode, Tool } from '@/lib/types'

export type IntroInputKind = 'plain' | 'markdown' | 'html' | 'file'

export type EditingToolPayload = Pick<
  Tool,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'website_url'
  | 'category_id'
  | 'logo_url'
  | 'screenshot_url'
  | 'introduction'
  | 'introduction_format'
>

const SUBMIT_CAT_NONE = '__submit_cat_none__'

function initialIntroState(
  editing?: EditingToolPayload,
): { kind: IntroInputKind; text: string } {
  if (!editing) return { kind: 'plain', text: '' }
  const intro = editing.introduction?.trim()
  if (intro) {
    const fmt = normalizeIntroductionFormat(editing.introduction_format)
    if (fmt === 'plain') return { kind: 'plain', text: intro }
    if (fmt === 'markdown') return { kind: 'markdown', text: intro }
    return { kind: 'html', text: intro }
  }
  return { kind: 'plain', text: editing.description ?? '' }
}

function initialTier1Pick(
  categories: Category[],
  navigation: NavigationMenuTreeNode[],
  editing?: EditingToolPayload,
): { primaryIdx: number; leafId: string } {
  const tier1 = buildSubmitNavigationTier1List(navigation, categories)
  if (!editing?.category_id) return { primaryIdx: -1, leafId: '' }
  for (let i = 0; i < tier1.length; i++) {
    const row = tier1[i]
    if (row.kind === 'menu_leaf' && idsEqual(row.categoryId, editing.category_id)) {
      return { primaryIdx: i, leafId: editing.category_id }
    }
    if (
      row.kind === 'menu_group' &&
      row.children.some((c) => idsEqual(c.categoryId, editing.category_id))
    ) {
      return { primaryIdx: i, leafId: editing.category_id }
    }
  }
  return { primaryIdx: -1, leafId: editing.category_id }
}

interface SubmitToolFormProps {
  categories: Category[]
  navigation: NavigationMenuTreeNode[]
  whitelistCategoryIds: string[] | null
  orphanEditingCategory?: Category | null
  userId: string
  editingTool?: EditingToolPayload
}

export function SubmitToolForm({
  categories,
  navigation,
  whitelistCategoryIds: _whitelistCategoryIds,
  orphanEditingCategory = null,
  userId,
  editingTool,
}: SubmitToolFormProps) {
  void _whitelistCategoryIds

  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const mdFileRef = useRef<HTMLInputElement>(null)

  const introInit = useMemo(
    () => initialIntroState(editingTool),
    [editingTool],
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const [name, setName] = useState(editingTool?.name ?? '')
  const [introKind, setIntroKind] = useState<IntroInputKind>(() => introInit.kind)
  const [introText, setIntroText] = useState(() => introInit.text)
  const [mdFileLabel, setMdFileLabel] = useState('')

  const [websiteUrl, setWebsiteUrl] = useState(editingTool?.website_url ?? '')
  const [logoUrl, setLogoUrl] = useState(editingTool?.logo_url ?? '')
  const [screenshotUrl, setScreenshotUrl] = useState(
    editingTool?.screenshot_url ?? '',
  )
  const [summaryDescription, setSummaryDescription] = useState(
    () => editingTool?.description?.trim() ?? '',
  )
  const [summaryUserEdited, setSummaryUserEdited] = useState(
    () => Boolean(editingTool?.description?.trim()),
  )

  const tier1 = useMemo(
    () => buildSubmitNavigationTier1List(navigation, categories),
    [categories, navigation],
  )

  const initPick = useMemo(
    () => initialTier1Pick(categories, navigation, editingTool),
    [categories, navigation, editingTool],
  )

  const [primaryIdx, setPrimaryIdx] = useState(() => initPick.primaryIdx)
  const [leafId, setLeafId] = useState(() => initPick.leafId)

  const onPrimaryChange = (raw: string) => {
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

  const currentRow = primaryIdx >= 0 ? tier1[primaryIdx] : undefined
  const showLeafSelect =
    currentRow?.kind === 'menu_group' && currentRow.children.length > 1

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  useEffect(() => {
    if (summaryUserEdited) return
    const body = introText.trim()
    const dbFormat: IntroductionFormat =
      introKind === 'file' || introKind === 'markdown'
        ? 'markdown'
        : introKind === 'html'
          ? 'html'
          : 'plain'
    if (!body) {
      setSummaryDescription('')
      return
    }
    setSummaryDescription(excerptForListing(body, dbFormat))
  }, [introText, introKind, summaryUserEdited])

  const handleImagePick = async (file: File, kind: 'logo' | 'screenshot') => {
    const setUrl = kind === 'logo' ? setLogoUrl : setScreenshotUrl
    const setUploading =
      kind === 'logo' ? setUploadingLogo : setUploadingScreenshot
    setUploading(true)
    setError('')
    try {
      const dataUrl = await fileToImageDataUrl(file)
      setUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败')
    } finally {
      setUploading(false)
    }
  }

  const regenerateSummaryFromIntro = () => {
    setError('')
    const body = introText.trim()
    if (!body) {
      setError('请先填写工具介绍')
      return
    }
    const dbFormat: IntroductionFormat =
      introKind === 'file' || introKind === 'markdown'
        ? 'markdown'
        : introKind === 'html'
          ? 'html'
          : 'plain'
    const next = excerptForListing(body, dbFormat)
    if (!next) {
      setError('介绍过短，无法生成概述')
      return
    }
    setSummaryDescription(next)
    setSummaryUserEdited(false)
  }

  const onIntroKindChange = (v: string) => {
    const k = v as IntroInputKind
    setIntroKind(k)
    if (k !== 'file') {
      setMdFileLabel('')
      if (mdFileRef.current) mdFileRef.current.value = ''
    }
  }

  const onMdPicked = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.md')) {
      setError('仅支持 .md 文件')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const t = typeof reader.result === 'string' ? reader.result : ''
      setIntroText(t)
      setMdFileLabel(file.name)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const previewFormat: IntroductionFormat =
    introKind === 'file' || introKind === 'markdown'
      ? 'markdown'
      : introKind === 'html'
        ? 'html'
        : 'plain'

  const previewLogoHref = useMemo(() => {
    if (editingTool?.slug?.trim()) {
      return toolPublicPath(editingTool.slug.trim())
    }
    const w = websiteUrl.trim()
    if (!w) return null
    try {
      new URL(w)
      return w
    } catch {
      return null
    }
  }, [editingTool?.slug, websiteUrl])

  const previewTool = useMemo((): Tool => {
    let resolvedCategoryId = ''
    if (primaryIdx >= 0 && primaryIdx < tier1.length) {
      const row = tier1[primaryIdx]
      if (row.kind === 'menu_leaf') {
        resolvedCategoryId = row.categoryId
      } else if (row.children.length === 1) {
        resolvedCategoryId = row.children[0].categoryId
      } else if (
        leafId &&
        row.children.some((c) => idsEqual(c.categoryId, leafId))
      ) {
        resolvedCategoryId = leafId
      }
    } else if (
      editingTool?.category_id &&
      orphanEditingCategory &&
      idsEqual(leafId, editingTool.category_id)
    ) {
      resolvedCategoryId = leafId
    }

    const cat = resolvedCategoryId
      ? categories.find((c) => idsEqual(c.id, resolvedCategoryId))
      : undefined

    const intro = introText.trim()
    const summary =
      summaryDescription.trim() ||
      (intro ? excerptForListing(intro, previewFormat) : '') ||
      ' '

    let ws = websiteUrl.trim()
    if (!ws) ws = 'https://example.com'
    try {
      new URL(ws)
    } catch {
      ws = 'https://example.com'
    }

    const now = new Date().toISOString()
    return {
      id: editingTool?.id ?? 'preview',
      name: name.trim() || '工具名称',
      slug: editingTool?.slug ?? 'preview',
      description: summary,
      website_url: ws,
      logo_url: logoUrl || null,
      screenshot_url: screenshotUrl || null,
      category_id: cat?.id ?? editingTool?.category_id ?? null,
      user_id: userId,
      status: 'pending',
      rejection_reason: null,
      is_featured: false,
      is_disabled: false,
      view_count: 0,
      favorite_count: 0,
      introduction: intro || null,
      introduction_format: previewFormat,
      use_cases: null,
      created_at: now,
      updated_at: now,
      category: cat,
    }
  }, [
    primaryIdx,
    tier1,
    leafId,
    categories,
    editingTool,
    orphanEditingCategory,
    introText,
    summaryDescription,
    previewFormat,
    websiteUrl,
    logoUrl,
    screenshotUrl,
    userId,
    name,
  ])

  const buildPayload = useCallback(() => {
    const body = introText.trim()
    const dbFormat: IntroductionFormat =
      introKind === 'file' || introKind === 'markdown'
        ? 'markdown'
        : introKind === 'html'
          ? 'html'
          : 'plain'

    if (!body) throw new Error('请填写工具介绍')
    if (introKind === 'plain' && body.length > INTRO_LIMIT_PLAIN) {
      throw new Error(`纯文本介绍最多 ${INTRO_LIMIT_PLAIN} 字`)
    }
    if (
      (introKind === 'markdown' ||
        introKind === 'html' ||
        introKind === 'file') &&
      body.length > INTRO_LIMIT_RICH
    ) {
      throw new Error(`当前格式下介绍内容过长（上限 ${INTRO_LIMIT_RICH} 字）`)
    }

    const description = summaryDescription.trim()
    if (!description) throw new Error('请填写概述描述')
    if (description.length > LISTING_DESCRIPTION_MAX) {
      throw new Error(`概述描述最多 ${LISTING_DESCRIPTION_MAX} 字`)
    }

    return { body, dbFormat, description }
  }, [introText, introKind, summaryDescription])

  const generateSlug = (toolName: string) => {
    return (
      toolName
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50) +
      '-' +
      Date.now().toString(36)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    let resolvedCategoryId = ''
    if (primaryIdx >= 0 && primaryIdx < tier1.length) {
      const row = tier1[primaryIdx]
      if (row.kind === 'menu_leaf') {
        resolvedCategoryId = row.categoryId
      } else if (row.children.length === 1) {
        resolvedCategoryId = row.children[0].categoryId
      } else if (
        leafId &&
        row.children.some((c) => idsEqual(c.categoryId, leafId))
      ) {
        resolvedCategoryId = leafId
      }
    } else if (
      editingTool?.category_id &&
      orphanEditingCategory &&
      idsEqual(leafId, editingTool.category_id)
    ) {
      resolvedCategoryId = leafId
    }

    try {
      if (!name.trim()) throw new Error('请输入工具名称')
      if (!websiteUrl.trim()) throw new Error('请输入网站地址')

      if (!resolvedCategoryId) {
        throw new Error('请选择工具分类（与侧栏菜单一致的分类入口）')
      }

      const cat = categories.find((c) => idsEqual(c.id, resolvedCategoryId))
      if (!cat) throw new Error('所选分类无效')

      try {
        new URL(websiteUrl)
      } catch {
        throw new Error('请输入有效的网站地址')
      }

      const { body, dbFormat, description } = buildPayload()

      const supabase = createClient()

      if (editingTool) {
        const { error: updateError } = await supabase
          .from('tools')
          .update({
            name: name.trim(),
            slug: editingTool.slug,
            description,
            introduction: body,
            introduction_format: dbFormat,
            website_url: websiteUrl.trim(),
            category_id: resolvedCategoryId,
            logo_url: logoUrl || null,
            screenshot_url: screenshotUrl || null,
            status: 'pending',
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTool.id)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        router.push('/account/history?resubmitted=true')
        return
      }

      const { error: insertError } = await supabase.from('tools').insert({
        name: name.trim(),
        slug: generateSlug(name),
        description,
        introduction: body,
        introduction_format: dbFormat,
        website_url: websiteUrl.trim(),
        category_id: resolvedCategoryId,
        logo_url: logoUrl || null,
        screenshot_url: screenshotUrl || null,
        user_id: userId,
        status: 'pending',
        is_disabled: false,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      router.push('/account/history?success=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openPreview = () => {
    setError('')
    try {
      buildPayload()
      setPreviewOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法预览')
    }
  }

  const introTextareaRows = introKind === 'html' ? 10 : 8
  const introMaxLen =
    introKind === 'plain' ? INTRO_LIMIT_PLAIN : INTRO_LIMIT_RICH

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tool-name" className="text-sm font-medium">
              工具名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tool-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：ChatGPT"
              maxLength={100}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
            <Label className="text-sm font-medium">
              工具介绍 <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              选择一种方式填写；详情页将按所选类型渲染（纯文本 / Markdown / HTML）。上传文件仅支持
              .md，内容按 Markdown 解析。
            </p>

            <RadioGroup
              value={introKind}
              onValueChange={onIntroKindChange}
              className="grid gap-2 sm:grid-cols-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="plain" id="intro-plain" />
                <Label htmlFor="intro-plain" className="cursor-pointer font-normal">
                  纯文本（最多 {INTRO_LIMIT_PLAIN} 字）
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="markdown" id="intro-md" />
                <Label htmlFor="intro-md" className="cursor-pointer font-normal">
                  Markdown
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="html" id="intro-html" />
                <Label htmlFor="intro-html" className="cursor-pointer font-normal">
                  HTML
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="file" id="intro-file" />
                <Label htmlFor="intro-file" className="cursor-pointer font-normal">
                  上传 .md 文件
                </Label>
              </div>
            </RadioGroup>

            {introKind === 'file' ? (
              <div className="space-y-2">
                <input
                  ref={mdFileRef}
                  type="file"
                  accept=".md,text/markdown"
                  className="hidden"
                  onChange={(e) => onMdPicked(e.target.files?.[0])}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => mdFileRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    选择 Markdown 文件
                  </Button>
                  {mdFileLabel ? (
                    <span className="text-xs text-muted-foreground">
                      已选：{mdFileLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <Textarea
                id="tool-introduction"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                placeholder={
                  introKind === 'plain'
                    ? '用文字介绍工具功能、亮点与适用人群…'
                    : introKind === 'markdown'
                      ? '支持 Markdown 标题、列表、链接、代码块等'
                      : '粘贴安全的 HTML 片段（脚本等将被过滤）'
                }
                rows={introTextareaRows}
                maxLength={introMaxLen}
                className="min-h-[140px] font-mono text-sm"
              />
            )}

            {introKind !== 'file' ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {introText.length}/{introMaxLen}
              </p>
            ) : introText.trim() ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                已载入 {introText.length} 字（上限 {INTRO_LIMIT_RICH}）
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="tool-summary" className="text-sm font-medium">
                概述描述 <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={regenerateSummaryFromIntro}
              >
                根据介绍重新生成
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              用于列表与详情顶栏等处的短文案；系统会根据「工具介绍」自动截取，你可以修改后再提交。
            </p>
            <Textarea
              id="tool-summary"
              value={summaryDescription}
              onChange={(e) => {
                setSummaryUserEdited(true)
                setSummaryDescription(e.target.value)
              }}
              placeholder="填写介绍后将自动生成，也可在此直接编辑"
              rows={4}
              maxLength={LISTING_DESCRIPTION_MAX}
              className="min-h-[100px] text-sm"
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {summaryDescription.length}/{LISTING_DESCRIPTION_MAX}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-website" className="text-sm font-medium">
              网站地址 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tool-website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                工具分类 <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                选项与侧栏菜单一致：折叠分组下会再选具体分类。
              </p>
            </div>

            {tier1.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
                侧栏中尚未配置可提交分类。请在「菜单管理」中为项填写{' '}
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                  /category/slug
                </code>{' '}
                链接，并为子菜单项绑定对应分类页。
              </p>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="submit-category-primary"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    分类入口
                  </Label>
                  <Select
                    value={
                      primaryIdx < 0 ? SUBMIT_CAT_NONE : String(primaryIdx)
                    }
                    onValueChange={(v) => {
                      if (v === SUBMIT_CAT_NONE) onPrimaryChange('')
                      else onPrimaryChange(v)
                    }}
                  >
                    <SelectTrigger
                      id="submit-category-primary"
                      className="h-10 w-full bg-background"
                    >
                      <SelectValue placeholder="请选择分类入口" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
                    >
                      <SelectItem value={SUBMIT_CAT_NONE}>
                        请选择分类入口
                      </SelectItem>
                      {tier1.map((row, i) => (
                        <SelectItem
                          key={
                            row.kind === 'menu_group'
                              ? `g-${row.navParentId}`
                              : `l-${row.categoryId}`
                          }
                          value={String(i)}
                        >
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showLeafSelect && currentRow?.kind === 'menu_group' ? (
                  <div className="space-y-2">
                    <Label
                      htmlFor="submit-category-leaf"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      具体分类
                    </Label>
                    <Select
                      value={leafId ? leafId : SUBMIT_CAT_NONE}
                      onValueChange={(v) =>
                        setLeafId(v === SUBMIT_CAT_NONE ? '' : v)
                      }
                    >
                      <SelectTrigger
                        id="submit-category-leaf"
                        className="h-10 w-full bg-background"
                      >
                        <SelectValue placeholder="请选择具体分类" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
                      >
                        <SelectItem value={SUBMIT_CAT_NONE}>
                          请选择具体分类
                        </SelectItem>
                        {currentRow.children.map((ch) => (
                          <SelectItem
                            key={ch.categoryId}
                            value={ch.categoryId}
                          >
                            {ch.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {currentRow?.kind === 'menu_group' &&
                currentRow.children.length === 1 ? (
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                    将归入「{currentRow.children[0].label}」
                  </p>
                ) : null}
              </div>
            )}

            {leafId ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">当前选择：</span>
                <span className="ml-1 font-medium text-foreground">
                  {categories.find((c) => idsEqual(c.id, leafId))?.name ?? '—'}
                </span>
              </div>
            ) : null}

            {orphanEditingCategory ? (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                当前草稿分类「{orphanEditingCategory.name}
                」未出现在当前菜单可选列表中；你可从上方重选分类，或仅在未改动分类时直接重新提交。
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">工具Logo</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImagePick(file, 'logo')
                e.target.value = ''
              }}
            />
            {logoUrl ? (
              <div className="relative inline-block">
                {previewLogoHref ? (
                  <a
                    href={previewLogoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block h-20 w-20 overflow-hidden rounded-xl border outline-none ring-offset-background hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="在新标签打开链接"
                  >
                    <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                  </a>
                ) : (
                  <div className="relative h-20 w-20 overflow-hidden rounded-xl border">
                    <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6"
                  onClick={() => setLogoUrl('')}
                  disabled={uploadingLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                上传Logo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              建议正方形，不超过2MB；将转为 Base64 保存在数据库中。
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">工具截图</Label>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImagePick(file, 'screenshot')
                e.target.value = ''
              }}
            />
            {screenshotUrl ? (
              <div className="relative">
                <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border">
                  <Image
                    src={screenshotUrl}
                    alt="Screenshot"
                    fill
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6"
                  onClick={() => setScreenshotUrl('')}
                  disabled={uploadingScreenshot}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => screenshotInputRef.current?.click()}
                disabled={uploadingScreenshot}
              >
                {uploadingScreenshot ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                上传截图
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              建议16:9，不超过2MB；将转为 Base64 保存在数据库中。
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openPreview}
            disabled={isSubmitting}
          >
            预览
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
            {editingTool ? '保存并重新提交审核' : '提交审核'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[min(92vh,920px)] max-w-4xl gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b px-6 py-4 sm:px-10">
            <DialogTitle>预览详情页</DialogTitle>
            <DialogDescription>
              与站点工具详情、后台预览的布局一致。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(min(92vh,920px)-5.5rem)] overflow-y-auto px-6 py-4 sm:px-10 md:px-14">
            <ToolDetailView
              tool={previewTool}
              logoHref={previewLogoHref ?? false}
              badges={
                <>
                  <Badge variant="outline">预览</Badge>
                  {previewTool.category ? (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                      {previewTool.category.name}
                    </span>
                  ) : null}
                </>
              }
              headerActions={
                (() => {
                  const w = websiteUrl.trim()
                  try {
                    if (!w) return null
                    new URL(w)
                  } catch {
                    return null
                  }
                  return (
                    <Button asChild size="sm" type="button">
                      <a
                        href={w}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        访问网站
                      </a>
                    </Button>
                  )
                })()
              }
              showComments={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </form>
  )
}
