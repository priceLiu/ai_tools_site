'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { idsEqual } from '@/lib/category-tree'
import { buildSubmitNavigationTier1List } from '@/lib/submit-category-choices'
import type { Category, NavigationMenuTreeNode, Tool } from '@/lib/types'

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
>

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
  /** 与侧栏一致的菜单树，用于解析与「二级菜单」对齐的可选分类 */
  navigation: NavigationMenuTreeNode[]
  /** 保留字段：预留按菜单白名单筛选（当前与侧栏一致时不需要） */
  whitelistCategoryIds: string[] | null
  /** 编辑时原分类已从菜单下架，仍可保留该项 */
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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(editingTool?.name ?? '')
  const [description, setDescription] = useState(editingTool?.description ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(editingTool?.website_url ?? '')
  const [logoUrl, setLogoUrl] = useState(editingTool?.logo_url ?? '')
  const [screenshotUrl, setScreenshotUrl] = useState(
    editingTool?.screenshot_url ?? '',
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

  const handleFileUpload = async (
    file: File,
    setUrl: (url: string) => void,
    setUploading: (uploading: boolean) => void,
  ) => {
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '上传失败')
      }

      setUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const generateSlug = (name: string) => {
    return (
      name
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
      if (!description.trim()) throw new Error('请输入工具描述')
      if (!websiteUrl.trim()) throw new Error('请输入网站地址')

      if (!resolvedCategoryId) {
        throw new Error('请选择工具分类（与侧栏菜单一致的分类入口）')
      }

      const cat = categories.find((c) => idsEqual(c.id, resolvedCategoryId))
      if (!cat) throw new Error('所选分类无效')

      // Validate URL
      try {
        new URL(websiteUrl)
      } catch {
        throw new Error('请输入有效的网站地址')
      }

      const supabase = createClient()

      if (editingTool) {
        const { error: updateError } = await supabase
          .from('tools')
          .update({
            name: name.trim(),
            slug: editingTool.slug,
            description: description.trim(),
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
        description: description.trim(),
        website_url: websiteUrl.trim(),
        category_id: resolvedCategoryId,
        logo_url: logoUrl || null,
        screenshot_url: screenshotUrl || null,
        user_id: userId,
        status: 'pending',
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

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              工具名称 <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：ChatGPT"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              工具描述 <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这个工具的功能和特点..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500
            </p>
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              网站地址 <span className="text-destructive">*</span>
            </label>
            <Input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">
                工具分类 <span className="text-destructive">*</span>
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                选项与侧栏菜单一致：折叠分组下会再选具体分类（如 pic1）。
              </p>
            </div>

            {tier1.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                侧栏中尚未配置可提交分类。请在「菜单管理」中为项填写{' '}
                <code className="rounded bg-muted px-1">/category/slug</code>{' '}
                链接，并为子菜单项绑定对应分类页。
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    分类入口
                  </span>
                  <select
                    className={cn(
                      'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none',
                      'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    )}
                    value={primaryIdx < 0 ? '' : String(primaryIdx)}
                    onChange={(e) => onPrimaryChange(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {tier1.map((row, i) => (
                      <option
                        key={
                          row.kind === 'menu_group'
                            ? `g-${row.navParentId}`
                            : `l-${row.categoryId}`
                        }
                        value={String(i)}
                      >
                        {row.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showLeafSelect && currentRow?.kind === 'menu_group' ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      具体分类
                    </span>
                    <select
                      className={cn(
                        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none',
                        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      )}
                      value={leafId}
                      onChange={(e) => setLeafId(e.target.value)}
                    >
                      <option value="">请选择具体分类</option>
                      {currentRow.children.map((ch) => (
                        <option key={ch.categoryId} value={ch.categoryId}>
                          {ch.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {currentRow?.kind === 'menu_group' &&
                currentRow.children.length === 1 ? (
                  <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    将归入「{currentRow.children[0].label}」
                  </p>
                ) : null}
              </div>
            )}

            {leafId ? (
              <div className="rounded-md border border-border bg-muted/35 px-3 py-2 text-sm">
                当前选择：
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

          {/* Logo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              工具Logo
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, setLogoUrl, setUploadingLogo)
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
              建议上传正方形图片，不超过5MB
            </p>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              工具截图
            </label>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file)
                  handleFileUpload(file, setScreenshotUrl, setUploadingScreenshot)
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
              建议上传16:9的截图，不超过5MB
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
            {editingTool ? '保存并重新提交审核' : '提交审核'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
