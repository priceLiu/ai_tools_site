'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { changeOwnPasswordAction } from '@/app/actions/change-password'

export function AccountChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    setSaving(true)
    try {
      const { error: err } = await changeOwnPasswordAction({
        currentPassword,
        newPassword,
      })
      if (err) {
        setError(err)
        return
      }
      setSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-6">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">修改密码</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              使用邮箱密码登录的账号可在此修改登录密码。
            </p>
          </div>
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-100">
              密码已更新，请使用新密码登录。
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="cur_pw">
              当前密码
            </label>
            <Input
              id="cur_pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                setSaved(false)
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="new_pw">
              新密码
            </label>
            <Input
              id="new_pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setSaved(false)
              }}
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">至少 6 位</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="new_pw2">
              确认新密码
            </label>
            <Input
              id="new_pw2"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setSaved(false)
              }}
              required
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="mr-2 h-4 w-4" />}
            更新密码
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
