'use client'

import Link from 'next/link'
import { useState, useMemo, useCallback } from 'react'
import { Sparkles, Flame, Star, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toolPublicPath } from '@/lib/tool-public-path'
import type { AdPlacement } from '@/lib/types'

interface HomeAdSection1Props {
  tabALabel: string
  tabBLabel: string
  tabCLabel: string
  tabA: AdPlacement[]
  tabB: AdPlacement[]
  tabC: AdPlacement[]
}

/**
 * 首页 Section 1：左竖向 tab + 右 16:9 卡片网格（纵向滚动）。
 *
 * 参考 docs/banner.html：
 * - 左侧 tab：图标在上 + 文字在下，竖向排列
 * - 右侧卡片：16:9 媒体卡，背景图 + 底部文字遮罩，纵向滚动两屏
 */
export function HomeAdSection1({
  tabALabel,
  tabBLabel,
  tabCLabel,
  tabA,
  tabB,
  tabC,
}: HomeAdSection1Props) {
  const [tab, setTab] = useState<'A' | 'B' | 'C'>(() =>
    tabA.length > 0 ? 'A' : tabB.length > 0 ? 'B' : 'C',
  )
  const list = tab === 'A' ? tabA : tab === 'B' ? tabB : tabC
  const empty = tabA.length === 0 && tabB.length === 0 && tabC.length === 0

  if (empty) return null

  return (
    <section
      aria-label="推荐 AI 工具"
      className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm"
    >
      <div className="flex gap-2">
        <TabRail
          tab={tab}
          onChange={setTab}
          tabALabel={tabALabel}
          tabBLabel={tabBLabel}
          tabCLabel={tabCLabel}
          countA={tabA.length}
          countB={tabB.length}
          countC={tabC.length}
        />
        <ToolGrid list={list} />
      </div>
    </section>
  )
}

function TabRail({
  tab,
  onChange,
  tabALabel,
  tabBLabel,
  tabCLabel,
  countA,
  countB,
  countC,
}: {
  tab: 'A' | 'B' | 'C'
  onChange: (t: 'A' | 'B' | 'C') => void
  tabALabel: string
  tabBLabel: string
  tabCLabel: string
  countA: number
  countB: number
  countC: number
}) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col gap-1 sm:w-[80px]">
      <TabButton
        active={tab === 'A'}
        Icon={Flame}
        label={tabALabel}
        count={countA}
        onClick={() => onChange('A')}
        disabled={countA === 0}
      />
      <TabButton
        active={tab === 'B'}
        Icon={BookOpen}
        label={tabBLabel}
        count={countB}
        onClick={() => onChange('B')}
        disabled={countB === 0}
      />
      <TabButton
        active={tab === 'C'}
        Icon={Star}
        label={tabCLabel}
        count={countC}
        onClick={() => onChange('C')}
        disabled={countC === 0}
      />
    </div>
  )
}

function TabButton({
  active,
  Icon,
  label,
  count,
  onClick,
  disabled,
}: {
  active: boolean
  Icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-all sm:text-xs',
        active
          ? 'bg-primary/10 text-primary shadow-inner'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40',
      )}
      aria-pressed={active}
    >
      <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', active && 'text-primary')} />
      <span className="line-clamp-1 max-w-full">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'absolute right-1 top-1 rounded-full px-1 text-[9px] font-medium leading-tight tabular-nums',
            active
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground/70',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function ToolGrid({ list }: { list: AdPlacement[] }) {
  const tools = useMemo(
    () =>
      list
        .filter((a) => a.tool != null)
        .map((a) => ({
          id: a.id,
          tool: a.tool!,
          bannerUrl: a.banner_url,
        })),
    [list],
  )

  if (tools.length === 0) {
    return (
      <div className="flex h-[180px] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
        该分组暂无投放
      </div>
    )
  }

  return (
    <div
      className={cn(
        'home-ad-scroll flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-muted/30',
        // 1.5 张 logo 的高度：单行卡片 + 半行（提示用户可下滑）
        'h-[140px] sm:h-[150px] md:h-[160px]',
      )}
    >
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tools.map(({ id, tool, bannerUrl }, idx) => (
          <MediaCard key={id} tool={tool} bannerUrl={bannerUrl} prefetch={idx < 5} />
        ))}
      </div>
    </div>
  )
}

function MediaCard({
  tool,
  bannerUrl,
  prefetch,
}: {
  tool: NonNullable<AdPlacement['tool']>
  bannerUrl?: string | null
  prefetch: boolean
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 1 && img.naturalHeight > 1) {
      setImgLoaded(true)
    } else {
      setImgError(true)
    }
  }, [])

  const handleError = useCallback(() => {
    setImgError(true)
  }, [])

  const imgSrc = bannerUrl || `/api/img/tool/${tool.id}/screenshot`
  const fallbackSrc = `/api/img/tool/${tool.id}/logo`
  const showFallback = !imgLoaded || imgError

  return (
    <Link
      href={toolPublicPath(tool.slug)}
      className={cn(
        'group relative block aspect-video overflow-hidden rounded-xl border border-border/40 bg-muted transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
      )}
      prefetch={prefetch}
      title={tool.description || tool.name}
    >
      {/* 背景图 */}
      {!imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={tool.name}
          loading="lazy"
          decoding="async"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity',
            imgLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* 无图占位：紫色渐变 + 工具 logo */}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-200 via-violet-300 to-purple-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fallbackSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-lg object-contain opacity-90 sm:h-12 sm:w-12"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <Sparkles className="absolute h-6 w-6 text-white/40" />
        </div>
      )}

      {/* 底部文字遮罩 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-2 pt-6">
        <p className="line-clamp-1 text-xs font-medium text-white drop-shadow sm:text-sm">
          {tool.name}
        </p>
      </div>
    </Link>
  )
}
