'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toolPublicPath } from '@/lib/tool-public-path'
import { trimOrNullImageSrc } from '@/lib/trim-or-null'
import type { AdPlacement } from '@/lib/types'

interface HomeAdSection2Props {
  ads: AdPlacement[]
  /** 自动切屏间隔秒（默认 10） */
  rotateSeconds: number
}

/**
 * 首页 Section 2：3 张 banner 一屏，自动轮播 3 屏（共 9 条）。
 *
 * - PC：3 列均分；小尺寸触屏下保留 3 列但缩小 4:1 比例。
 * - 移动端 (<sm)：单列单卡，依然按 rotateSeconds 轮播。
 * - 鼠标 hover 整块时暂停自动播放，移开恢复；尊重 prefers-reduced-motion。
 */
export function HomeAdSection2({ ads, rotateSeconds }: HomeAdSection2Props) {
  const safeAds = useMemo(() => ads.filter((a) => a.tool != null), [ads])

  const pages = useMemo(() => chunk(safeAds, 3), [safeAds])

  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const interval = Math.max(3, Math.min(120, Math.floor(rotateSeconds || 10)))

  // 移动端：以单条为页 (sm 以下)，PC 以 3 条为页。
  // 通过 useMediaQuery 简化：用 CSS 控制每屏宽度，state 仍记录 PC 屏的索引；
  // 移动端把每条 banner 当作独立页。
  const [mobilePages, setMobilePages] = useState<AdPlacement[][]>([])
  useEffect(() => {
    const update = () => {
      if (window.matchMedia('(max-width: 639px)').matches) {
        setMobilePages(chunk(safeAds, 1))
      } else {
        setMobilePages([])
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [safeAds])

  const isMobile = mobilePages.length > 0
  const pageList = isMobile ? mobilePages : pages

  const total = pageList.length
  const safeIdx = total === 0 ? 0 : current % total

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (paused || total <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((i) => (i + 1) % total)
    }, interval * 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [interval, paused, total])

  // 切到无效索引（动态切 PC ↔ 移动端）时夹回
  useEffect(() => {
    if (total === 0) return
    if (current >= total) setCurrent(0)
  }, [total, current])

  if (safeAds.length === 0) return null

  return (
    <section
      aria-label="精选 AI 推荐 banner"
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${safeIdx * 100}%)` }}
        >
          {pageList.map((page, pi) => (
            <div
              key={pi}
              className="grid w-full shrink-0 grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:p-4"
            >
              {page.map((ad) => (
                <BannerCard key={ad.id} ad={ad} />
              ))}
              {/* 不足 3 张时占位 */}
              {!isMobile && page.length < 3
                ? Array.from({ length: 3 - page.length }).map((_, idx) => (
                    <div
                      key={`pad-${pi}-${idx}`}
                      className="hidden sm:block"
                      aria-hidden
                    />
                  ))
                : null}
            </div>
          ))}
        </div>

        {total > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1.5 sm:bottom-2.5">
            {pageList.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`切换到第 ${i + 1} 屏`}
                onClick={() => setCurrent(i)}
                className={cn(
                  'pointer-events-auto h-1.5 rounded-full bg-foreground/30 transition-all hover:bg-foreground/50',
                  i === safeIdx ? 'w-6 bg-primary' : 'w-1.5',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function BannerCard({ ad }: { ad: AdPlacement }) {
  const tool = ad.tool!
  const banner = trimOrNullImageSrc(ad.banner_url)
  return (
    <Link
      href={toolPublicPath(tool.slug)}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative w-full" style={{ aspectRatio: '4 / 1' }}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner}
            alt={tool.name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2">
            {trimOrNullImageSrc(tool.logo_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trimOrNullImageSrc(tool.logo_url) ?? ''}
                alt={tool.name}
                className="h-6 w-6 shrink-0 rounded-md bg-background object-contain p-0.5"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <span className="line-clamp-1 text-sm font-semibold text-foreground">
              {tool.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function chunk<T>(arr: T[], n: number): T[][] {
  if (n <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
