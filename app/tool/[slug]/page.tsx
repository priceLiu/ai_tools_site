import { cache, Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { ToolDetailPublicView } from '@/components/tool-detail-public-view'
import {
  toolDetailPageGutterClass,
  toolDetailMaxWidthClass,
} from '@/lib/tool-detail-layout'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import * as neon from '@/lib/neon/data'
import { toolPublicPath } from '@/lib/tool-public-path'
import { getSiteUrl } from '@/lib/site-url'

/** 60s ISR：后台保存通过 `revalidatePath` 立即推送 */
export const revalidate = 60
export const dynamicParams = true

/** 同一请求内 generateMetadata 与 page 共享一次取数 */
const getToolBySlugCached = cache((slug: string) =>
  neon.neonGetToolPublicBySlug(slug),
)

interface ToolPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const slugs = await neon.neonListApprovedToolSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[tool/[slug] generateStaticParams] 跳过预生成:', e)
    }
    return []
  }
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) {
    return { title: '工具未找到', robots: { index: false } }
  }
  const tool = await getToolBySlugCached(slug)
  if (!tool) {
    return { title: '工具未找到', robots: { index: false } }
  }
  const desc =
    (tool.description ?? '').trim() ||
    `了解 ${tool.name} 的功能、定价与使用方式，更多 AI 工具尽在 AI 工具集。`
  const path = toolPublicPath(slug)
  const ogImages = tool.logo_url ? [{ url: tool.logo_url, alt: tool.name }] : undefined
  const cat = tool.category?.name
  return {
    title: cat ? `${tool.name} · ${cat}` : tool.name,
    description: desc,
    keywords: [tool.name, cat, 'AI 工具', 'AI 工具推荐']
      .filter(Boolean)
      .join(', '),
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: path,
      title: tool.name,
      description: desc,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.name,
      description: desc,
      images: ogImages?.map((i) => i.url),
    },
  }
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) notFound()

  const tool = await getToolBySlugCached(slug)
  if (!tool) notFound()

  const [navigation, sceneSummaries] = await Promise.all([
    getNavigationMenuTreeStatic(),
    neon.neonListPublicSceneSummariesForTool(tool.id),
  ])

  const siteUrl = getSiteUrl()
  const toolUrl = `${siteUrl}${toolPublicPath(slug)}`

  /**
   * Schema.org `SoftwareApplication`：让 Google 富片段可以拿到工具名、描述、分类、图、收藏数（作为评分基数）。
   * 仅在有非空 description 与 website_url 时才输出，避免把空内容塞给爬虫。
   */
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: tool.description || undefined,
    applicationCategory: tool.category?.name,
    operatingSystem: 'Web',
    url: toolUrl,
    sameAs: tool.website_url || undefined,
    image: tool.logo_url || undefined,
  }
  if (typeof tool.favorite_count === 'number' && tool.favorite_count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: 5,
      ratingCount: tool.favorite_count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: `${siteUrl}/`,
      },
      ...(tool.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: tool.category.name,
              item: `${siteUrl}/category/${encodeURIComponent(tool.category.slug)}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: tool.category ? 3 : 2,
        name: tool.name,
        item: toolUrl,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} enableHomeAnchors={false} />

      <div className="md:pl-64">
        <HeaderUser navigation={navigation} />

        <main className={toolDetailPageGutterClass}>
          <div className={toolDetailMaxWidthClass}>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary md:mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>

            {/**
             * `<ToolDetailPublicView>` 内用 `useSearchParams()` 读 `?admin_preview=1`。
             * 必须包 `<Suspense>`，否则 Next 会把整页 deopt 成 dynamic 渲染，
             * 60s ISR 会失效。
             */}
            <Suspense fallback={null}>
              <ToolDetailPublicView tool={tool} sceneSummaries={sceneSummaries} />
            </Suspense>
          </div>
        </main>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </div>
  )
}
