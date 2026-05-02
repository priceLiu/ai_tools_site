'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { User, Upload, Trash2 } from 'lucide-react'
import { fileToImageDataUrl } from '@/lib/image-data-url'
import type { Profile } from '@/lib/types'

interface AccountAvatarEditorProps {
  profile: Profile | null
}

export function AccountAvatarEditor({ profile }: AccountAvatarEditorProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? '')
  }, [profile?.avatar_url])

  const persist = async (url: string | null) => {
    if (!profile) return
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: up } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', profile.id)
      if (up) throw new Error(up.message)
      setAvatarUrl(url ?? '')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const onPick = async (file: File | undefined) => {
    if (!file || !profile) return
    try {
      const dataUrl = await fileToImageDataUrl(file)
      await persist(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败')
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const onClear = async () => {
    if (!profile || !avatarUrl) return
    await persist(null)
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" fill className="object-cover" sizes="80px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <User className="h-9 w-9" aria-hidden />
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">头像</p>
        <p className="text-xs text-muted-foreground">
          支持 JPG / PNG / GIF / WebP，最大 2MB；将安全保存在您的资料中。
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!profile || busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            上传头像
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              disabled={!profile || busy}
              onClick={() => void onClear()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
