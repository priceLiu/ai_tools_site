import type { Metadata } from 'next'
import Image from 'next/image'
import { Sidebar } from '@/components/sidebar'
import { SitePublicHeader } from '@/components/site-public-header'
import { HomeToolSections } from '@/components/home-tool-sections'
import { HomeScrollToHash } from '@/components/home-scroll-to-hash'
import { HomeAdSection1 } from '@/components/home-ad-section1'
import { HomeAdSection2 } from '@/components/home-ad-section2'
import { HomeTagCategoriesSection } from '@/components/home-tag-categories'
import { getHomeToolBundle } from '@/lib/cached-home-data'
import { getHomeAdsBundle } from '@/lib/cached-home-ads'
import { getHomeTagCategoryCards } from '@/lib/cached-home-tag-categories'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import { getSiteUrl } from '@/lib/site-url'

/** ISR：60s TTL；后台变更通过 `revalidateTag` / `revalidatePath('/')` 立即推送 */
export const revalidate = 60

/** 首页 metadata：显式 canonical，title 走 layout 默认（不重复挂模板）。 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/', type: 'website' },
}

export default async function HomePage() {
  const [bundle, navigation, ads, tagCategoryCards] = await Promise.all([
    getHomeToolBundle(),
    getNavigationMenuTreeStatic(),
    getHomeAdsBundle(),
    getHomeTagCategoryCards(),
  ])

  const siteUrl = getSiteUrl()
  /**
   * `WebSite` + `SearchAction`：Google 可能在搜索结果展示站内搜索框；
   * `Organization` 给品牌主体一个稳定标识。
   */
  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AI 工具集',
    url: `${siteUrl}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AI 工具集',
    url: `${siteUrl}/`,
    /**
     * Schema.org Organization logo：用 PNG（部分爬虫对 WebP 兼容差）。
     * 文件 `public/logo-zhixuanai.png` = 512×512 110KB，符合 Google
     * Knowledge Panel 推荐的 ≥ 112px 最小尺寸；视觉展示用同名 .webp。
     */
    logo: `${siteUrl}/logo-zhixuanai.png`,
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeScrollToHash />
      <Sidebar navigation={navigation} enableHomeAnchors />

      <div className="md:pl-64">
        <SitePublicHeader navigation={navigation} enableHomeAnchors />

        <main className="px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-4 flex flex-col items-center md:mb-6">
            {/**
             * 品牌 logo：原图 2048×2048 PNG 1.3MB（手机网络下"一行行渐进解码"）。
             * 2026-05-06 优化：sips 缩到 512×512 后再 cwebp -q 85 转 WebP → 31KB（42× 缩小）。
             * 显示宽 224px（md 56），512×512 仍是 2.3× 视网膜余量。
             * 原图在 git 历史里：`git show HEAD~:public/logo-zhixuanai.png` 可恢复。
             */}
            <Image
              src="/logo-zhixuanai.png"
              alt="智选 AI · 打工人、创业老板、自由职业，找 AI 上智选"
              width={512}
              height={512}
              priority
              className="h-auto w-40 md:w-56"
            />
            {/* h1 留给 SEO，视觉上不显示，避免与 logo 文字重复 */}
            <h1 className="sr-only">智选 AI · 发现最适合你的 AI 工具</h1>
          </div>

          <div className="mx-auto mb-6 w-full max-w-[min(100%,94rem)] space-y-4 md:mb-8">
            {ads.settings.enabled_section1 &&
            (ads.section1A.length > 0 || ads.section1B.length > 0 || ads.section1C.length > 0) ? (
              <HomeAdSection1
                tabALabel={ads.settings.section1_tab_a_label}
                tabBLabel={ads.settings.section1_tab_b_label}
                tabCLabel={ads.settings.section1_tab_c_label}
                tabA={ads.section1A}
                tabB={ads.section1B}
                tabC={ads.section1C}
              />
            ) : null}
            {ads.settings.enabled_section2 && ads.section2.length > 0 ? (
              <HomeAdSection2
                ads={ads.section2}
                rotateSeconds={ads.settings.section2_rotate_seconds}
              />
            ) : null}
          </div>

          <div className="mx-auto w-full max-w-[min(100%,94rem)]">
            <HomeTagCategoriesSection cards={tagCategoryCards} />
          </div>

          <HomeToolSections bundle={bundle} />
        </main>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
    </div>
  )
}
