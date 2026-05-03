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
  featuredToolsCount: number
  uncategorizedCount: number
  categoryBars: AdminCategoryBarDatum[]
}

export function AdminStatsPanel({
  parentCategoryCount,
  totalTools,
  featuredToolsCount,
  uncategorizedCount,
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
        top: '8%',
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
            <CardDescription>全部工具数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalTools}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            含各审核状态与禁用标记，与列表一致
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>热门工具数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {featuredToolsCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1">is_featured = true</code>
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
            <code className="rounded bg-muted px-1">category_id</code> 为空
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>各分类工具数量</CardTitle>
          <CardDescription>
            按分类表中顺序展示；子类标签为「父类名 · 子类名」。柱高为归属该
            <code className="mx-1 rounded bg-muted px-1">category_id</code>
            的工具条数。
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
