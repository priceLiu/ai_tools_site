'use client'

import { useState, useRef } from 'react'
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
import { Spinner } from '@/components/ui/spinner'
import { Upload, X } from 'lucide-react'
import type { Category, Tool } from '@/lib/types'

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

interface SubmitToolFormProps {
  categories: Category[]
  userId: string
  /** 仅被拒绝的条目可传入，用于修改并重新提交 */
  editingTool?: EditingToolPayload
}

export function SubmitToolForm({
  categories,
  userId,
  editingTool,
}: SubmitToolFormProps) {
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [name, setName] = useState(editingTool?.name ?? '')
  const [description, setDescription] = useState(editingTool?.description ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(editingTool?.website_url ?? '')
  const [categoryId, setCategoryId] = useState(editingTool?.category_id ?? '')
  const [logoUrl, setLogoUrl] = useState(editingTool?.logo_url ?? '')
  const [screenshotUrl, setScreenshotUrl] = useState(
    editingTool?.screenshot_url ?? '',
  )
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  const handleFileUpload = async (
    file: File,
    setUrl: (url: string) => void,
    setUploading: (uploading: boolean) => void
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
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) + '-' + Date.now().toString(36)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    try {
      // Validation
      if (!name.trim()) throw new Error('请输入工具名称')
      if (!description.trim()) throw new Error('请输入工具描述')
      if (!websiteUrl.trim()) throw new Error('请输入网站地址')
      if (!categoryId) throw new Error('请选择分类')
      
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
            category_id: categoryId,
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

      const { error: insertError } = await supabase
        .from('tools')
        .insert({
          name: name.trim(),
          slug: generateSlug(name),
          description: description.trim(),
          website_url: websiteUrl.trim(),
          category_id: categoryId,
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
          
          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              分类 <span className="text-destructive">*</span>
            </label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.slug !== 'hot').map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                if (file) handleFileUpload(file, setScreenshotUrl, setUploadingScreenshot)
              }}
            />
            {screenshotUrl ? (
              <div className="relative">
                <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border">
                  <Image src={screenshotUrl} alt="Screenshot" fill className="object-cover" />
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
