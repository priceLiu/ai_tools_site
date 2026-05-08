import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { SitePublicHeader } from '@/components/site-public-header'
import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import * as neon from '@/lib/neon/data'
import { getSiteUrl } from '@/lib/site-url'
import { tagCategoryPublicPath, tagPublicPath } from '@/lib/tag-slug'

/** 60s ISR：标签写入 / 合并 / 删除时由后台 `revalidatePath('/tag-category/[slug]', 'page')` 推送 */
export const revalidate = 60
export const dynamicParams = true

const getCategoryBySlugCached = cache((slug: string) =>
  neon.neonGetTagCategoryBySlug(slug),
)

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const cats = await neon.neonListTagCategoriesEnabled()
    return cats
      .map((c) => (c.slug ?? '').trim())
      .filter((s) => s.length > 0)
      .map((slug) => ({ slug }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[tag-category/[slug] generateStaticParams] 跳过预生成:', e)
    }
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const cat = await getCategoryBySlugCached(slug)
  if (!cat) return { title: '场景分类未找到', robots: { index: false } }
  const path = tagCategoryPublicPath(slug)
  const desc =
    cat.description?.trim() ||
    `${cat.name} · 按场景找 AI：聚合该场景下所有 curated 标签与对应工具。`
  return {
    title: `${cat.name} · 按场景找 AI 工具`,
    description: desc,
    keywords: [cat.name, '按场景找 AI', 'AI 工具推荐'].join(', '),
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: `${cat.name} · 按场景找 AI 工具`,
      description: desc,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${cat.name} · 按场景找 AI 工具`,
      description: desc,
    },
  }
}

export default async function TagCategoryPage({ params }: PageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const cat = await getCategoryBySlugCached(slug)
  if (!cat) notFound()

  const [navigation, tags, tools] = await Promise.all([
    getNavigationMenuTreeStatic(),
    neon.neonListTagsForCategoryWithCounts(cat.id, 80),
    neon.neonListToolsByTagCategoryId(cat.id),
  ])

  const siteUrl = getSiteUrl()
  const path = tagCategoryPublicPath(slug)

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${cat.name} · 按场景找 AI 工具`,
    url: `${siteUrl}${path}`,
    description: cat.description ?? undefined,
    isPartOf: { '@type': 'WebSite', url: siteUrl },
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.name} · AI 工具`,
    numberOfItems: tools.length,
    itemListElement: tools.slice(0, 30).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/tool/${encodeURIComponent(t.slug)}`,
      name: t.name,
    })),
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} enableHomeAnchors />
      <div className="md:pl-[162px]">
        <SitePublicHeader navigation={navigation} enableHomeAnchors />
        <main className="px-3 py-4 sm:px-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary md:mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <div className="mb-5 md:mb-8">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                按场景找 AI · 一级分类
              </p>
              <h1 className="mt-1 text-xl font-bold text-foreground md:text-2xl">
                {cat.name}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                共 {tools.length} 个工具 · {tags.length} 个细分标签
              </p>
              {cat.description && (
                <p className="mt-2 text-sm text-foreground/80">
                  {cat.description}
                </p>
              )}
            </div>

            {tags.length > 0 && (
              <div className="mb-6 rounded-xl border bg-card/50 p-4">
                <p className="mb-2 text-sm font-semibold">细分标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Link
                      key={t.id}
                      href={tagPublicPath(t.name)}
                      className="inline-flex"
                    >
                      <Badge
                        variant="secondary"
                        className="gap-1 hover:bg-primary hover:text-primary-foreground"
                      >
                        {t.name}
                        <span className="text-[10px] tabular-nums opacity-70">
                          {t.tool_count}
                        </span>
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tools.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} fluid />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  暂无工具
                </h2>
                <p className="mt-2 text-muted-foreground">
                  该一级分类下还没有打上 curated 标签的工具
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
    </div>
  )
}
