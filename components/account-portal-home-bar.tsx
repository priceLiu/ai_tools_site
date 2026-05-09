'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Profile, PortalSectionConfigEntry } from '@/lib/types'
import { normalizePortalSections } from '@/lib/account-portal-section-defaults'
import {
  savePortalSectionsAction,
  savePortalThemeAction,
  submitShowcaseApplicationAction,
  requestShowcaseRevokePublicationAction,
} from '@/app/account/home/actions'
import {
  excellentSolutionsDetailPath,
} from '@/lib/account-portal-path'
import { Settings2, Sparkles, User, BellOff } from 'lucide-react'

const SECTION_LABELS: Record<PortalSectionConfigEntry['id'], string> = {
  follows: '关注（分组展示）',
  favorites: '收藏（分组展示）',
  comments: '评论',
  submissions: '提交（分组展示）',
}

export function AccountPortalHomeBar({
  profile,
  email,
}: {
  profile: Profile
  email: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [sections, setSections] = useState(() =>
    normalizePortalSections(profile.portal_section_config),
  )
  const [theme, setTheme] = useState(profile.portal_theme ?? 'default')
  const [applyOpen, setApplyOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [titleIn, setTitleIn] = useState(profile.showcase_title ?? '')
  const [summaryIn, setSummaryIn] = useState(profile.showcase_summary ?? '')

  const disabledPortal = profile.portal_disabled_by_admin === true
  const st = profile.showcase_status ?? 'none'

  function persistSections(next: PortalSectionConfigEntry[]) {
    startTransition(() => {
      void (async () => {
        const r = await savePortalSectionsAction(next)
        if (r.error) toast.error(r.error)
        else {
          setSections(next)
          toast.success('板块顺序已保存')
        }
      })()
    })
  }

  function move(idx: number, dir: -1 | 1) {
    const sorted = [...sections].sort((a, b) => a.order - b.order)
    const j = idx + dir
    if (j < 0 || j >= sorted.length) return
    const copy = [...sorted]
    const tmp = copy[idx]
    copy[idx] = copy[j]
    copy[j] = tmp
    const next = copy.map((s, i) => ({ ...s, order: i }))
    persistSections(next)
  }

  function toggleVisible(id: PortalSectionConfigEntry['id'], checked: boolean) {
    const sorted = [...sections].sort((a, b) => a.order - b.order)
    const next = sorted.map((s) =>
      s.id === id ? { ...s, visible: checked } : s,
    )
    persistSections(next.map((s, i) => ({ ...s, order: i })))
  }

  function submitApply() {
    startTransition(() => {
      void (async () => {
        const r = await submitShowcaseApplicationAction({
          title: titleIn,
          summary: summaryIn,
        })
        if (r.error) toast.error(r.error)
        else {
          toast.success('已提交审核，请等待管理员处理')
          setApplyOpen(false)
          router.refresh()
        }
      })()
    })
  }

  function onThemeChange(val: string) {
    setTheme(val)
    startTransition(() => {
      void (async () => {
        const r = await savePortalThemeAction(val)
        if (r.error) toast.error(r.error)
        else toast.success('样式模板已更新')
      })()
    })
  }

  function submitRevokeNotice() {
    startTransition(() => {
      void (async () => {
        const r = await requestShowcaseRevokePublicationAction()
        if (r.error) toast.error(r.error)
        else {
          toast.success('已通知管理员处理撤销请求')
          router.refresh()
        }
      })()
    })
  }

  return (
    <div className="mb-8 space-y-4 border-b border-border pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {profile.display_name?.trim() || '未设置昵称'}
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {email || '—'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/account/profile">
                  <User className="mr-1.5 h-3.5 w-3.5" />
                  个人信息
                </Link>
              </Button>
              {st === 'approved' && profile.showcase_slug ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={excellentSolutionsDetailPath(profile.showcase_slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    查看公开发布页
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {disabledPortal ? (
            <Badge variant="destructive">管理员已关闭门户</Badge>
          ) : (
            <>
              {st === 'approved' && profile.showcase_slug ? (
                profile.showcase_revoke_requested_at ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    撤销请求已提交，待管理员处理
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={submitRevokeNotice}
                  >
                    <BellOff className="mr-1.5 h-3.5 w-3.5" />
                    通知撤销发布
                  </Button>
                )
              ) : null}
              <Sheet open={manageOpen} onOpenChange={setManageOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    板块与样式
                  </Button>
                </SheetTrigger>
                <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>板块与样式</SheetTitle>
                    <SheetDescription>
                      调整板块顺序与显示；样式仅影响排版密度与留白。
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-2">
                    <Label>样式模板</Label>
                    <Select value={theme} onValueChange={onThemeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">默认</SelectItem>
                        <SelectItem value="minimal">简洁（更疏）</SelectItem>
                        <SelectItem value="dense">紧凑</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>板块顺序</Label>
                    <ul className="space-y-2">
                      {[...sections]
                        .sort((a, b) => a.order - b.order)
                        .map((s, idx) => (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={s.visible}
                              onCheckedChange={(v) =>
                                toggleVisible(s.id, v === true)
                              }
                              id={`sec-${s.id}`}
                            />
                            <label
                              htmlFor={`sec-${s.id}`}
                              className="flex-1 cursor-pointer leading-snug"
                            >
                              {SECTION_LABELS[s.id]}
                            </label>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                disabled={idx === 0}
                                onClick={() => move(idx, -1)}
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                disabled={
                                  idx === sections.length - 1
                                }
                                onClick={() => move(idx, 1)}
                              >
                                ↓
                              </Button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                </SheetContent>
              </Sheet>

              <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={
                      st === 'pending' ||
                      st === 'approved' ||
                      disabledPortal
                    }
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    申请发布
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>申请发布到主站</DialogTitle>
                    <DialogDescription>
                      提交后需管理员审核。通过后将生成静态展示页，并出现在「优秀 AI
                      解决方案」汇总中。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pub-title">标题</Label>
                      <Input
                        id="pub-title"
                        value={titleIn}
                        onChange={(e) => setTitleIn(e.target.value)}
                        placeholder="对外展示的解决方案标题"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pub-sum">简介</Label>
                      <Textarea
                        id="pub-sum"
                        value={summaryIn}
                        onChange={(e) => setSummaryIn(e.target.value)}
                        rows={4}
                        placeholder="一两句话说明你的 AI 工具组合或使用心得（10～500 字）"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setApplyOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={submitApply}>提交审核</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {st === 'pending' ? (
                <Badge variant="secondary">发布审核中</Badge>
              ) : null}
              {st === 'rejected' ? (
                <Badge variant="destructive">上次申请未通过</Badge>
              ) : null}
            </>
          )}
        </div>
      </div>

      {disabledPortal ? (
        <p className="text-sm text-muted-foreground">
          你的个人主页门户已被管理员关闭，仅可使用个人信息与其它菜单功能。
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          以下为「我的关注」中的置顶工具，以及你已订阅的场景 / 角色下收录的工具（与「我的关注」页列表同源）；其后为收藏（不与关注重复）、评论与提交。点击工具卡片在个人主页内打开详情。
        </p>
      )}
    </div>
  )
}
