'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Profile } from '@/lib/types'
import { setPortalHomeEnabledAction } from '@/app/account/home/actions'
import { accountPortalHomePath } from '@/lib/account-portal-path'

export function AccountPortalPreferenceCard({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const forcedOff = profile.portal_disabled_by_admin === true
  const enabled = profile.portal_home_enabled !== false

  const toggle = (checked: boolean) => {
    startTransition(() => {
      void (async () => {
        const r = await setPortalHomeEnabledAction(checked)
        if (r.error) toast.error(r.error)
        else {
          toast.success(checked ? '已开启个人主页入口' : '已改为以个人信息为主入口')
          router.refresh()
        }
      })()
    })
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">个人主页门户</CardTitle>
        <CardDescription>
          开启后，进入「个人中心」默认展示聚合主页（关注 / 收藏 / 评论 /
          提交）；关闭则以本页「个人信息」为主入口。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled && !forcedOff}
            disabled={forcedOff}
            onCheckedChange={(v) => toggle(v)}
            id="portal-home-enabled"
          />
          <label htmlFor="portal-home-enabled" className="text-sm">
            {forcedOff
              ? '管理员已强制关闭门户（无法自行开启）'
              : enabled
                ? '个人主页已开启'
                : '个人主页已关闭'}
          </label>
        </div>
        {!forcedOff && enabled ? (
          <Button asChild variant="outline" size="sm">
            <Link href={accountPortalHomePath()}>前往个人主页</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
