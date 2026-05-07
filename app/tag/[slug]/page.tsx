import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { ToolCard } from '@/components/tool-card'
import { Badge } from '@/components/ui/badge'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import * as neon from '@/lib/neon/data'
import { getSiteUrl } from '@/lib/site-url'
import {
  decodeTagNameFromSlug,
  tagCategoryPublicPath,
  tagPublicPath,
} from '@/lib/tag-slug'

/** 60s ISR：标签合并 / 改名时由后台 `revalidatePath('/tag/[slug]', 'page')` 推送 */
export const revalidate = 60
export const dynamicParams = true

const getTagByNameCached = cache((name: string) => neon.neonGetTagByName(name))

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * 只为 curated 标签预生成（数量更可控；非 curated 标签按需 ISR）。
 */
export async function generateStaticParams() {
  try {
    const tags = await neon.neonAdminListTagsAll()
    return tags
      .filter((t) => t.is_curated)
      .map((t) => ({ slug: encodeURIComponent(t.name) }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[tag/[slug] generateStaticParams] 跳过预生成:', e)
    }
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params
  const name = decodeTagNameFromSlug(raw)
  if (!name) return { title: '标签未找到', robots: { index: false } }
  const tag = await getTagByNameCached(name)
  if (!tag) return { title: '标签未找到', robots: { index: false } }
  const path = tagPublicPath(tag.name)
  const desc = `${tag.name}相关 AI 工具精选；按热度与最新收录综合排序。`
  return {
    title: `${tag.name} · AI 工具`,
    description: desc,
    keywords: [tag.name, 'AI 工具推荐', 'AI 工具'].join(', '),
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: `${tag.name} · AI 工具`,
      description: desc,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tag.name} · AI 工具`,
      description: desc,
    },
  }
}

export default async function TagPage({ params }: PageProps) {
  const { slug: raw } = await params
  const name = decodeTagNameFromSlug(raw)
  if (!name) notFound()

  const tag = await getTagByNameCached(name)
  if (!tag) notFound()

  const [navigation, tools] = await Promise.all([
    getNavigationMenuTreeStatic(),
    neon.neonListToolsByTagId(tag.id),
  ])

  const rawParent = tag.tag_category_id
    ? await neon.neonGetTagCategoryById(tag.tag_category_id)
    : null

  const tagCategory =
    rawParent && !rawParent.is_disabled ? rawParent : null

  const sceneLabel = rawParent
    ? rawParent.is_disabled
      ? `${rawParent.name}（场景分类已禁用）`
      : rawParent.name
    : '未归入场景分类'

  const siteUrl = getSiteUrl()
  const path = tagPublicPath(tag.name)

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${tag.name} · AI 工具`,
    url: `${siteUrl}${path}`,
    isPartOf: tagCategory
      ? {
          '@type': 'WebSite',
          url: `${siteUrl}${tagCategoryPublicPath(tagCategory.slug)}`,
          name: tagCategory.name,
        }
      : undefined,
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${tag.name} · AI 工具`,
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
      <div className="md:pl-64">
        <HeaderUser navigation={navigation} enableHomeAnchors />
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
                标签
              </p>
              <h1 className="mt-1 text-xl font-bold text-foreground md:text-2xl">
                {tag.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
                <span>共 {tools.length} 个工具</span>
                {rawParent ? (
                  <>
                    <span>·</span>
                    {tagCategory ? (
                      <Link
                        href={tagCategoryPublicPath(rawParent.slug)}
                        className="underline-offset-2 hover:underline"
                      >
                        「{rawParent.name}」场景分类
                      </Link>
                    ) : (
                      <span>场景分类「{rawParent.name}」已禁用</span>
                    )}
                  </>
                ) : null}
              </div>
              <Badge
                variant={tagCategory ? 'default' : 'outline'}
                className="mt-2"
              >
                {sceneLabel}
              </Badge>
            </div>

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
                  当前还没有打上「{tag.name}」标签的工具
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
