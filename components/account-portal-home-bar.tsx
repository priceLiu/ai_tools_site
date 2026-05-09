'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
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
} from '@/app/account/home/actions'
import { excellentSolutionsDetailPath } from '@/lib/account-portal-path'
import { Settings2, Sparkles, User } from 'lucide-react'
import type { ShowcasePublishEligibilityCounts } from '@/lib/account-showcase-eligibility'
import { AccountShowcasePublishToolbar } from '@/components/account-showcase-publish-section'

const SECTION_LABELS: Record<PortalSectionConfigEntry['id'], string> = {
  follows: '关注（分组展示）',
  favorites: '收藏（分组展示）',
  comments: '评论',
  submissions: '提交（分组展示）',
}

export function AccountPortalHomeBar({
  profile,
  email,
  showcaseEligibility,
}: {
  profile: Profile
  email: string
  showcaseEligibility: ShowcasePublishEligibilityCounts
}) {
  const [, startTransition] = useTransition()
  const [sections, setSections] = useState(() =>
    normalizePortalSections(profile.portal_section_config),
  )
  const [theme, setTheme] = useState(profile.portal_theme ?? 'default')
  const [manageOpen, setManageOpen] = useState(false)

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
              <AccountShowcasePublishToolbar
                profile={profile}
                eligibility={showcaseEligibility}
                betweenRevokeAndApply={
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
                                    disabled={idx === sections.length - 1}
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
                }
              />
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
