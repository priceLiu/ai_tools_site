import type { Metadata } from 'next'
import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { HomeToolSections } from '@/components/home-tool-sections'
import { HomeScrollToHash } from '@/components/home-scroll-to-hash'
import { Sparkles } from 'lucide-react'
import { getHomeToolBundle } from '@/lib/cached-home-data'
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
  const [bundle, navigation] = await Promise.all([
    getHomeToolBundle(),
    getNavigationMenuTreeStatic(),
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
    logo: `${siteUrl}/icon.svg`,
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeScrollToHash />
      <Sidebar navigation={navigation} enableHomeAnchors />

      <div className="md:pl-64">
        <HeaderUser navigation={navigation} enableHomeAnchors />

        <main className="px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-6 text-center md:mb-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 md:mb-4 md:h-16 md:w-16">
              <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
            </div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl">
              AI工具集
            </h1>
            <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">
              发现全网最好用的AI工具
            </p>
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
