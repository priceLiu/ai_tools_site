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
import { roleLucideIcon } from '@/lib/role-lucide-icons'
import {
  rolePublicPath,
  tagCategoryPublicPath,
  tagPublicPath,
} from '@/lib/tag-slug'
import type { TagCategory } from '@/lib/types'

/** 60s ISR：标签 / 角色 / 工具任意写入都会失效 */
export const revalidate = 60
export const dynamicParams = true

interface PageProps {
  params: Promise<{ slug: string }>
}

const getRoleBundleCached = cache(async (slug: string) => {
  const role = await neon.neonGetRoleCategoryBySlug(slug)
  if (!role) return null
  const [tagCategories, linkedTags, tools, enabledRoleCount] = await Promise.all([
    neon.neonListTagCategoriesEnabled(),
    neon.neonListTagsForRolePage(role.id),
    neon.neonListToolsByRoleCategoryId(role.id),
    neon.neonCountRoleCategoriesEnabled(),
  ])

  const catIdSet = new Set(
    linkedTags.map((t) => t.tag_category_id).filter((x): x is string => Boolean(x)),
  )
  const matchedCategories: TagCategory[] = []
  for (const id of catIdSet) {
    const c = tagCategories.find((x) => x.id === id)
    if (c) matchedCategories.push(c)
  }
  matchedCategories.sort((a, b) => a.sort_order - b.sort_order)

  return { role, linkedTags, tools, matchedCategories, enabledRoleCount }
})

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return []
  try {
    const slugs = await neon.neonListRoleCategoryEnabledSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const role = await neon.neonGetRoleCategoryBySlug(slug)
  if (!role) return { title: '角色未找到', robots: { index: false } }
  const path = rolePublicPath(role.slug)
  const sub = role.tagline?.trim() ? role.tagline.trim() : role.name
  const desc =
    role.description?.trim() ?? `${role.name}：站内 AI 工具推荐与标签导航。`
  return {
    title: `${role.name}专属 AI 工具 · ${sub}`,
    description: desc,
    keywords: [role.name, sub, 'AI 工具推荐'].join(', '),
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: `${role.name} · ${sub}`,
      description: desc,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${role.name} · ${sub}`,
      description: desc,
    },
  }
}

export default async function RolePage({ params }: PageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const bundle = await getRoleBundleCached(slug)
  if (!bundle) notFound()

  const { role, matchedCategories, linkedTags, tools, enabledRoleCount } = bundle

  const navigation = await getNavigationMenuTreeStatic()

  const Icon = roleLucideIcon(role.icon)

  const siteUrl = getSiteUrl()
  const path = rolePublicPath(role.slug)
  const sub = role.tagline?.trim() ? role.tagline.trim() : role.name
  const bodyText =
    role.description?.trim() ?? '通过关联标签聚合本站已审核的 AI 工具。'

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${role.name} · ${sub}`,
    url: `${siteUrl}${path}`,
    description: bodyText,
    isPartOf: { '@type': 'WebSite', url: siteUrl },
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${role.name} · AI 工具`,
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
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 md:h-12 md:w-12">
                  <Icon className="h-5 w-5 text-primary md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    角色专属
                    {enabledRoleCount > 0 ? <> · {enabledRoleCount} 选 1</> : null}
                  </p>
                  <h1 className="mt-0.5 text-xl font-bold text-foreground md:text-2xl">
                    {role.name}
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-primary">{sub}</p>
                  <p className="mt-2 text-sm text-foreground/80">{bodyText}</p>
                </div>
              </div>
            </div>

            {matchedCategories.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  关联场景（标签归属）：
                </span>
                {matchedCategories.map((c) => (
                  <Link key={c.id} href={tagCategoryPublicPath(c.slug)}>
                    <Badge variant="default">{c.name}</Badge>
                  </Link>
                ))}
              </div>
            )}

            {linkedTags.length > 0 && (
              <div className="mb-6 rounded-xl border bg-card/50 p-4">
                <p className="mb-2 text-sm font-semibold">推荐标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {linkedTags.map((t) => (
                    <Link key={t.id} href={tagPublicPath(t.name)}>
                      <Badge
                        variant="secondary"
                        className="hover:bg-primary hover:text-primary-foreground"
                      >
                        {t.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3 text-sm text-muted-foreground">
              共 {tools.length} 个工具（按推荐 + 最新综合排序）
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
                  请在本站后台「角色分类管理」为本品关联标签，或为工具打上对应标签。
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
