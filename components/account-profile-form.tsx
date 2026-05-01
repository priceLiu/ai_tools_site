'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { Profile } from '@/lib/types'

interface AccountProfileFormProps {
  profile: Profile | null
  email: string | null
}

export function AccountProfileForm({ profile, email }: AccountProfileFormProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const supabase = createClient()
      const trimmed = displayName.trim() || null
      const { error: up } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', profile.id)
      if (up) throw new Error(up.message)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-6 pt-6">
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              已保存
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium">登录邮箱</label>
            <Input value={email ?? '—'} readOnly disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">邮箱由账号系统提供，如需修改请到登录提供商设置。</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="display_name">
              昵称 / 展示名称
            </label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setSaved(false)
              }}
              placeholder="在站点上显示的名称"
              maxLength={80}
              disabled={!profile}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving || !profile}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            保存
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
