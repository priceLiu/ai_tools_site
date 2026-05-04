'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  insertToolCommentAction,
  listToolCommentsAction,
} from '@/app/actions/database-mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { MessageCircle, Send } from 'lucide-react'
import type { ToolComment } from '@/lib/types'
import type { AuthUser } from '@/lib/auth/session'

interface ToolCommentsSectionProps {
  toolId: string
  initialUser?: AuthUser | null
  initialNickname?: string | null
}

export function ToolCommentsSection({
  toolId,
  initialUser,
  initialNickname,
}: ToolCommentsSectionProps) {
  const pathname = usePathname()
  const loginHref = `/auth/login?redirect=${encodeURIComponent(pathname || '/')}`

  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null)
  const [comments, setComments] = useState<ToolComment[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [nickname, setNickname] = useState(initialNickname ?? '')
  const [email, setEmail] = useState(initialUser?.email ?? '')
  const [website, setWebsite] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadComments = useCallback(async () => {
    setLoadingList(true)
    const { comments: list, error } = await listToolCommentsAction(toolId)
    if (!error) {
      setComments(list)
    } else {
      setComments([])
    }
    setLoadingList(false)
  }, [toolId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!cancelled && r.ok) {
        const j = (await r.json()) as { user: AuthUser | null }
        setUser(j.user ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user?.email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('请先登录后再发表评论')
      return
    }
    setError('')
    const n = nickname.trim()
    const em = email.trim()
    const wb = website.trim()
    const b = body.trim()
    if (!b) {
      setError('请填写评论内容')
      return
    }
    if (!n) {
      setError('请填写昵称')
      return
    }
    if (!em || !em.includes('@')) {
      setError('请填写有效邮箱')
      return
    }
    if (wb && !/^https?:\/\//i.test(wb)) {
      setError('网址需以 http:// 或 https:// 开头')
      return
    }
    setSubmitting(true)
    try {
      const { error: ins } = await insertToolCommentAction({
        tool_id: toolId,
        body: b,
        nickname: n,
        email: em,
        website: wb || null,
      })
      if (ins) throw new Error(ins)
      setBody('')
      await loadComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : '发表评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  const count = comments.length

  return (
    <Card className="scroll-mt-4">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-primary" />
          {count === 0 ? '暂无评论' : `${count} 条评论`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {user ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <div className="relative mt-1 h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-muted">
                {nickname || user.email ? (
                  <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    {(nickname || user.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  评论正文 <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="写下你对该工具的体验、建议或问题…"
                  rows={4}
                  maxLength={5000}
                  className="resize-none bg-muted/50 text-sm"
                  disabled={submitting}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="comment-nickname" className="text-sm font-medium">
                      昵称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="comment-nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="例如：AI 爱好者"
                      maxLength={80}
                      disabled={submitting}
                      className="bg-muted/50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comment-email" className="text-sm font-medium">
                      联系邮箱 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="comment-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={255}
                      disabled={submitting}
                      className="bg-muted/50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comment-website" className="text-sm font-medium">
                      个人网站（选填）
                    </Label>
                    <Input
                      id="comment-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://"
                      maxLength={500}
                      disabled={submitting}
                      className="bg-muted/50 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Spinner className="mr-2 h-4 w-4" />}
                    <Send className="mr-2 h-4 w-4" />
                    发表评论
                  </Button>
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>
            </div>
          </form>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            登录后可发表评论；访客可浏览下方已有评论。{' '}
            <Button asChild variant="link" className="h-auto p-0 text-sm">
              <Link href={loginHref}>去登录</Link>
            </Button>
          </p>
        )}

        <div className="rounded-lg border bg-muted/30">
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              暂无评论…
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {comments.map((c) => (
                <li key={c.id} className="px-4 py-4 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {c.nickname}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString('zh-CN')}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {c.body}
                  </p>
                  {(c.website?.trim?.() ?? '').length > 0 && (
                    <a
                      href={c.website!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      {c.website}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
