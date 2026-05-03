'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { AdminFeaturedToggle } from '@/components/admin-featured-toggle'
import { AdminDisableToggleButton } from '@/components/admin-disable-toggle-button'
import { updateApprovedToolAdminAction } from '@/app/admin/tools/actions'
import {
  LISTING_DESCRIPTION_MAX,
  excerptForListing,
  type IntroductionFormat,
} from '@/lib/introduction-format'
import { fileToImageDataUrl } from '@/lib/image-data-url'
import { Upload, X } from 'lucide-react'
import type { Category } from '@/lib/types'

const ADMIN_CAT_NONE = '__admin_cat_none__'

interface AdminApprovedToolEditorProps {
  toolId: string
  toolStatus: 'pending' | 'approved' | 'rejected'
  initialName: string
  initialDescription: string
  initialWebsiteUrl: string
  initialLogoUrl: string | null
  initialScreenshotUrl: string | null
  initialIntroduction: string
  initialIntroductionFormat: IntroductionFormat
  initialCategoryId: string | null
  /** category_id 有值但联表 categories 不存在时传入，用于下拉占位 */
  staleCategoryId?: string | null
  initialDisabled: boolean
  initialFeatured: boolean
  /** 缺省或异常时按空列表处理，避免 RSC/缓存抖动导致展开报错 */
  categories?: Category[] | null
}

export function AdminApprovedToolEditor({
  toolId,
  toolStatus,
  initialName,
  initialDescription,
  initialWebsiteUrl,
  initialLogoUrl,
  initialScreenshotUrl,
  initialIntroduction,
  initialIntroductionFormat,
  initialCategoryId,
  staleCategoryId,
  initialDisabled,
  initialFeatured,
  categories: categoriesProp,
}: AdminApprovedToolEditorProps) {
  const categories = categoriesProp ?? []
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [screenshotUrl, setScreenshotUrl] = useState(initialScreenshotUrl ?? '')
  const [introduction, setIntroduction] = useState(initialIntroduction)
  const [introFormat, setIntroFormat] =
    useState<IntroductionFormat>(initialIntroductionFormat)
  const [categoryId, setCategoryId] = useState(
    initialCategoryId ?? ADMIN_CAT_NONE,
  )
  const [message, setMessage] = useState<string | null>(null)

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [logoReadProgress, setLogoReadProgress] = useState<
    number | 'indeterminate' | null
  >(null)
  const [screenshotReadProgress, setScreenshotReadProgress] = useState<
    number | 'indeterminate' | null
  >(null)

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [categories],
  )

  const handleImagePick = async (file: File, kind: 'logo' | 'screenshot') => {
    const setUrl = kind === 'logo' ? setLogoUrl : setScreenshotUrl
    const setUploading =
      kind === 'logo' ? setUploadingLogo : setUploadingScreenshot
    const setReadProgress =
      kind === 'logo' ? setLogoReadProgress : setScreenshotReadProgress
    setUploading(true)
    setReadProgress(0)
    setMessage(null)
    try {
      const dataUrl = await fileToImageDataUrl(file, {
        onProgress: (p) => {
          if (p === null) setReadProgress('indeterminate')
          else setReadProgress(p)
        },
      })
      setUrl(dataUrl)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '图片处理失败')
    } finally {
      setUploading(false)
      setReadProgress(null)
    }
  }

  const regenerateSummaryFromIntro = () => {
    setMessage(null)
    const body = introduction.trim()
    if (!body) {
      setMessage('请先填写工具介绍')
      return
    }
    const next = excerptForListing(body, introFormat)
    if (!next) {
      setMessage('介绍过短，无法生成概述')
      return
    }
    setDescription(next)
  }

  const save = async () => {
    setMessage(null)
    const r = await updateApprovedToolAdminAction({
      toolId,
      name,
      description,
      website_url: websiteUrl,
      logo_url: logoUrl.trim() || null,
      screenshot_url: screenshotUrl.trim() || null,
      introduction: introduction.trim() || null,
      introduction_format: introFormat,
      category_id:
        categoryId === ADMIN_CAT_NONE || !categoryId ? null : categoryId,
    })
    if (r.error) {
      setMessage(r.error)
      return
    }
    setMessage('已保存')
    startTransition(() => router.refresh())
  }

  const showApprovedToggles = toolStatus === 'approved'

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">编辑工具信息</h3>
      <p className="text-xs text-muted-foreground">
        名称、概述、官网、Logo、截图、详细介绍与分类在此保存后写入数据库。
        {showApprovedToggles
          ? ' 「禁用 / 设为热门」可单独立即生效。'
          : null}
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
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor={`admin-tool-desc-${toolId}`}>概述描述</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => regenerateSummaryFromIntro()}
          >
            根据介绍生成概述
          </Button>
        </div>
        <Textarea
          id={`admin-tool-desc-${toolId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={LISTING_DESCRIPTION_MAX}
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/{LISTING_DESCRIPTION_MAX}
        </p>
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

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-category-${toolId}`}>分类</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id={`admin-tool-category-${toolId}`} className="w-full">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
          >
            <SelectItem value={ADMIN_CAT_NONE}>未分类</SelectItem>
            {staleCategoryId &&
            staleCategoryId === categoryId &&
            !sortedCategories.some((c) => c.id === staleCategoryId) ? (
              <SelectItem value={staleCategoryId}>
                （无效分类 id，请重选）
              </SelectItem>
            ) : null}
            {sortedCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>工具介绍格式</Label>
        <Select
          value={introFormat}
          onValueChange={(v) => setIntroFormat(v as IntroductionFormat)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="plain">纯文本</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-intro-${toolId}`}>工具介绍（详情正文）</Label>
        <Textarea
          id={`admin-tool-intro-${toolId}`}
          value={introduction}
          onChange={(e) => setIntroduction(e.target.value)}
          rows={12}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-logo-url-${toolId}`}>Logo（图片地址或上传）</Label>
        <Input
          id={`admin-tool-logo-url-${toolId}`}
          placeholder="https://… 或留空"
          value={logoUrl.startsWith('data:') ? '' : logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          title={
            logoUrl.startsWith('data:')
              ? '当前为上传的图片；输入链接可改为外链'
              : undefined
          }
        />
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
            <div className="relative h-20 w-20 overflow-hidden rounded-xl border">
              <Image src={logoUrl} alt="Logo" fill className="object-cover" />
            </div>
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
            size="sm"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            上传 Logo
          </Button>
        )}
        {uploadingLogo && logoReadProgress !== null ? (
          <div className="space-y-1">
            <Progress
              value={
                logoReadProgress === 'indeterminate'
                  ? undefined
                  : logoReadProgress
              }
              className={
                logoReadProgress === 'indeterminate' ? 'animate-pulse' : ''
              }
            />
            <p className="text-xs text-muted-foreground">
              {logoReadProgress === 'indeterminate'
                ? '读取中…'
                : `读取 ${logoReadProgress}%`}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          支持 http(s) 外链或本地上传（≤2MB，存为 Base64）。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`admin-tool-shot-url-${toolId}`}>
          产品截图（图片地址或上传）
        </Label>
        <Input
          id={`admin-tool-shot-url-${toolId}`}
          placeholder="https://… 或留空"
          value={screenshotUrl.startsWith('data:') ? '' : screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          title={
            screenshotUrl.startsWith('data:')
              ? '当前为上传的图片；输入链接可改为外链'
              : undefined
          }
        />
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
            size="sm"
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
        {uploadingScreenshot && screenshotReadProgress !== null ? (
          <div className="space-y-1">
            <Progress
              value={
                screenshotReadProgress === 'indeterminate'
                  ? undefined
                  : screenshotReadProgress
              }
              className={
                screenshotReadProgress === 'indeterminate'
                  ? 'animate-pulse'
                  : ''
              }
            />
            <p className="text-xs text-muted-foreground">
              {screenshotReadProgress === 'indeterminate'
                ? '读取中…'
                : `读取 ${screenshotReadProgress}%`}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          支持 http(s) 外链或本地上传（≤2MB，存为 Base64）。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {showApprovedToggles ? (
          <>
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
          </>
        ) : null}
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
