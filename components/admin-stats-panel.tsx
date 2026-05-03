'use client'

import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type AdminCategoryBarDatum = {
  id: string
  label: string
  count: number
}

export type AdminStatsPanelProps = {
  parentCategoryCount: number
  totalTools: number
  /** 已通过且未禁用，与前台列表一致 */
  publicListedCount: number
  featuredToolsCount: number
  uncategorizedCount: number
  /** 未填分类中，仍已通过且未禁用的条数 */
  uncategorizedPublicCount: number
  categoryBars: AdminCategoryBarDatum[]
}

export function AdminStatsPanel({
  parentCategoryCount,
  totalTools,
  publicListedCount,
  featuredToolsCount,
  uncategorizedCount,
  uncategorizedPublicCount,
  categoryBars,
}: AdminStatsPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return

    if (chartInstance.current) {
      chartInstance.current.dispose()
      chartInstance.current = null
    }

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartInstance.current = chart

    const labels = categoryBars.map((d) => d.label)
    const counts = categoryBars.map((d) => d.count)

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: labels.some((l) => l.length > 8) ? '18%' : '12%',
        top: '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          rotate: labels.length > 6 ? 38 : 0,
          interval: 0,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
      },
      series: [
        {
          name: '工具数',
          type: 'bar',
          data: counts,
          barMaxWidth: 48,
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 11,
            color: '#64748b',
            distance: 6,
          },
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#a78bfa' },
              { offset: 1, color: '#7c3aed' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    })

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartInstance.current = null
    }
  }, [categoryBars])

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>一级分类（父分类）数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {parentCategoryCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1">categories.parent_id</code>{' '}
            为空的条目数
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>库内工具记录数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalTools}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            含待审核、已拒绝、已禁用等。前台可见（
            <code className="rounded bg-muted px-1">已通过</code>
            且未
            <code className="rounded bg-muted px-1">禁用</code>
            ）：<strong className="text-foreground">{publicListedCount}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>首页「热门工具」数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {featuredToolsCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            与首页热门区块一致：须
            <code className="rounded bg-muted px-1">approved</code>、
            未禁用且
            <code className="rounded bg-muted px-1">is_featured</code>
            （未通过/禁用即使勾选热门也不展示）
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>未关联分类</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {uncategorizedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1">category_id</code> 为空；
            其中前台可见：
            <strong className="text-foreground">{uncategorizedPublicCount}</strong>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>各分类工具数量</CardTitle>
          <CardDescription>
            除
            <strong className="text-foreground"> slug 为 hot（热门工具） </strong>
            外，各柱为归入该分类、
            <strong className="text-foreground"> 已通过且未禁用 </strong>
            的工具数。
            <span className="mt-1 block text-muted-foreground">
              「热门工具」柱与首页
              <code className="rounded bg-muted px-1">#home-hot</code>、
              <code className="rounded bg-muted px-1">/category/hot</code>{' '}
              一致：统计全站
              <code className="rounded bg-muted px-1">is_featured</code>
              ，而非仅归属该分类 ID 的记录。
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={chartRef}
            className="h-[min(28rem,calc(100vh-22rem))] w-full min-h-[260px]"
            role="img"
            aria-label="各分类工具数量柱状图"
          />
        </CardContent>
      </Card>
    </div>
  )
}
