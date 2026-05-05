import Link from 'next/link'
import { ArrowLeft, Megaphone, ToggleLeft, ToggleRight, AlertCircle, Clock4 } from 'lucide-react'
import * as neon from '@/lib/neon/data'
import { getAdSettings } from '@/lib/ad-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AdminAdsManager } from '@/components/admin-ads-manager'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '广告位管理 - 管理后台',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminAdsPage() {
  const [ads, settings, stats] = await Promise.all([
    neon.neonListAdsForAdmin(),
    getAdSettings(),
    neon.neonCountActiveAdsByPlacement(),
  ])

  return (
    <div className="p-3 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl">广告位管理</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              首页搜索区下方的两个广告版块；支持时效、排序、上下架；前台总开关与轮播间隔可配置。
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-2 grid-cols-2 sm:grid-cols-4 sm:gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                {settings.enabled_section1 ? (
                  <ToggleRight className="h-4 w-4 text-purple-600" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">
                  {stats.section1A + stats.section1B + stats.section1C}
                </p>
                <p className="text-xs text-muted-foreground">
                  Section 1（A {stats.section1A} / B {stats.section1B} / C {stats.section1C}）
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100">
                {settings.enabled_section2 ? (
                  <ToggleRight className="h-4 w-4 text-sky-600" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.section2}</p>
                <p className="text-xs text-muted-foreground">Section 2 生效</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">待审核投放</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                <Clock4 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{settings.section2_rotate_seconds}s</p>
                <p className="text-xs text-muted-foreground">Section 2 轮播间隔</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <AdminAdsManager initialAds={ads} initialSettings={settings} />
      </div>
    </div>
  )
}
