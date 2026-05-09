'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Profile } from '@/lib/types'
import type { ShowcasePublishEligibilityCounts } from '@/lib/account-showcase-eligibility'
import { isShowcasePublishEligible } from '@/lib/account-showcase-eligibility'
import {
  submitShowcaseApplicationAction,
  requestShowcaseRevokePublicationAction,
} from '@/app/account/home/actions'
import { excellentSolutionsDetailPath } from '@/lib/account-portal-path'
import { Sparkles, BellOff, CheckCircle2, Circle } from 'lucide-react'

function ApplyPublishDialog({
  profile,
  eligibilityOk,
  disabledPortal,
  trigger,
}: {
  profile: Profile
  eligibilityOk: boolean
  disabledPortal: boolean
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [titleIn, setTitleIn] = useState(profile.showcase_title ?? '')
  const [summaryIn, setSummaryIn] = useState(profile.showcase_summary ?? '')
  const st = profile.showcase_status ?? 'none'

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
          setOpen(false)
          router.refresh()
        }
      })()
    })
  }

  const applyBlocked =
    disabledPortal ||
    st === 'pending' ||
    st === 'approved' ||
    !eligibilityOk

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={applyBlocked}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申请发布到主站</DialogTitle>
          <DialogDescription>
            提交后需管理员审核。通过后将生成静态展示页，并出现在「AI
            方案集」汇总中。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pub-title">标题</Label>
            <Input
              id="pub-title"
              value={titleIn}
              onChange={(e) => setTitleIn(e.target.value)}
              placeholder="对外展示的方案标题"
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submitApply}>提交审核</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EligibilityChecklist({
  eligibility,
}: {
  eligibility: ShowcasePublishEligibilityCounts
}) {
  const rows = [
    {
      ok: eligibility.followToolCount > 0,
      label: '我的关注',
      hint: '至少有一条可关注范围内的工具（置顶或订阅场景/角色下列表非空）',
      href: '/account/follows',
    },
    {
      ok: eligibility.favoriteCount > 0,
      label: '我的收藏',
      hint: '至少收藏过一个工具',
      href: '/favorites',
    },
    {
      ok: eligibility.submissionCount > 0,
      label: '提交工具',
      hint: '至少提交过一个工具（任意审核状态）',
      href: '/submit',
    },
  ] as const

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li
          key={row.href}
          className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2"
        >
          {row.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
              <Link
                href={row.href}
                className="text-primary underline-offset-4 hover:underline"
              >
                {row.label}
              </Link>
              <span className="text-muted-foreground font-normal">
                （{row.ok ? '已满足' : '未有数据'}）
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 个人信息页：公开发布说明 + 申请入口 */
export function AccountShowcasePublishCard({
  profile,
  eligibility,
}: {
  profile: Profile
  eligibility: ShowcasePublishEligibilityCounts
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const disabledPortal = profile.portal_disabled_by_admin === true
  const st = profile.showcase_status ?? 'none'
  const eligible = isShowcasePublishEligible(eligibility)

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

  if (disabledPortal) {
    return (
      <Card id="showcase-publish" className="mb-8 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-lg">AI 方案集 · 公开发布</CardTitle>
          <CardDescription>
            管理员已关闭你的个人门户相关能力，当前无法申请公开发布。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (st === 'approved' && profile.showcase_slug) {
    return (
      <Card id="showcase-publish" className="mb-8 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-lg">AI 方案集 · 公开发布</CardTitle>
          <CardDescription>
            你的方案已通过审核并对外展示，无需再次申请。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
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
          {profile.showcase_revoke_requested_at ? (
            <Badge variant="outline" className="font-normal">
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
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="showcase-publish" className="mb-8 scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-lg">AI 方案集 · 公开发布</CardTitle>
        <CardDescription>
          向主站申请通过后，你的精选工具组合将出现在「AI
          方案集」汇总中，并生成独立展示页。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          申请前请先积累主页内容：下列三项均须至少有数据，管理员审核时会参考你的关注、收藏与提交。
        </p>
        <EligibilityChecklist eligibility={eligibility} />
        <div className="flex flex-wrap items-center gap-2">
          <ApplyPublishDialog
            profile={profile}
            eligibilityOk={eligible}
            disabledPortal={disabledPortal}
            trigger={
              <Button size="sm" disabled={!eligible || st === 'pending'}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                申请发布
              </Button>
            }
          />
          {st === 'pending' ? (
            <Badge variant="secondary">发布审核中</Badge>
          ) : null}
          {st === 'rejected' ? (
            <Badge variant="destructive">上次申请未通过</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/** 个人主页顶栏：撤销 / 申请入口 / 状态徽标（不含「板块与样式」Sheet） */
export function AccountShowcasePublishToolbar({
  profile,
  eligibility,
  betweenRevokeAndApply,
}: {
  profile: Profile
  eligibility: ShowcasePublishEligibilityCounts
  betweenRevokeAndApply?: ReactNode
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const disabledPortal = profile.portal_disabled_by_admin === true
  const st = profile.showcase_status ?? 'none'
  const eligible = isShowcasePublishEligible(eligibility)

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

  if (disabledPortal) return null

  return (
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

      {betweenRevokeAndApply}

      {st !== 'approved' ? (
        <>
          {!eligible ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/account/profile#showcase-publish">
                申请条件说明
              </Link>
            </Button>
          ) : (
            <ApplyPublishDialog
              profile={profile}
              eligibilityOk={eligible}
              disabledPortal={disabledPortal}
              trigger={
                <Button size="sm" disabled={st === 'pending'}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  申请发布
                </Button>
              }
            />
          )}
          {st === 'pending' ? (
            <Badge variant="secondary">发布审核中</Badge>
          ) : null}
          {st === 'rejected' ? (
            <Badge variant="destructive">上次申请未通过</Badge>
          ) : null}
        </>
      ) : null}
    </>
  )
}
