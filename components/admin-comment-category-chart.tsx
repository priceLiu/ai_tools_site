'use client'

import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type AdminCommentCategoryDatum = { label: string; count: number }

export function AdminCommentCategoryChart({
  data,
}: {
  data: AdminCommentCategoryDatum[]
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = chartRef.current
    if (!el || data.length === 0) return

    if (chartInstance.current) {
      chartInstance.current.dispose()
      chartInstance.current = null
    }

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartInstance.current = chart

    const labels = data.map((d) => d.label)
    const counts = data.map((d) => d.count)

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: labels.some((l) => l.length > 10) ? '22%' : '14%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          rotate: labels.length > 5 ? 32 : 0,
          interval: 0,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        name: '可见评论数',
        nameTextStyle: { fontSize: 11, color: '#64748b' },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
      },
      series: [
        {
          name: '评论数',
          type: 'bar',
          data: counts,
          barMaxWidth: 42,
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
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#0284c7' },
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
  }, [data])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>各分类评论数</CardTitle>
          <CardDescription>仅统计前台可见评论（未隐藏）</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">暂无数据</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>各分类评论数</CardTitle>
        <CardDescription>
          按工具所属分类汇总<strong className="font-medium">可见</strong>评论；未分类工具归入「未分类」
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[min(420px,55vh)] w-full min-h-[280px]" />
      </CardContent>
    </Card>
  )
}
