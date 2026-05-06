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
  TAG_ROLES,
  TAG_ROLE_SLUGS,
  getTagRoleBySlug,
} from '@/lib/tag-roles'
import {
  rolePublicPath,
  tagCategoryPublicPath,
  tagPublicPath,
} from '@/lib/tag-slug'
import type { Tool } from '@/lib/types'

/** 60s ISR：标签 / 分类 / 工具任意写入都会失效 */
export const revalidate = 60
export const dynamicParams = false

interface PageProps {
  params: Promise<{ slug: string }>
}

const getRoleBundleCached = cache(async (slug: string) => {
  const role = getTagRoleBySlug(slug)
  if (!role) return null
  const tagCategories = await neon.neonListTagCategoriesAll()
  const matchedCategoryIds = role.tagCategoryNames
    .map((n) => tagCategories.find((c) => c.name === n)?.id)
    .filter((x): x is string => Boolean(x))

  const toolsByCategory: Tool[][] = await Promise.all(
    matchedCategoryIds.map((cid) => neon.neonListToolsByTagCategoryId(cid)),
  )
  const dedup = new Map<string, Tool>()
  for (const list of toolsByCategory) {
    for (const t of list) dedup.set(t.id, t)
  }
  const tools: Tool[] = Array.from(dedup.values()).sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return { role, tagCategories, matchedCategoryIds, tools }
})

export async function generateStaticParams() {
  return TAG_ROLE_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const role = getTagRoleBySlug(slug)
  if (!role) return { title: '角色未找到', robots: { index: false } }
  const path = rolePublicPath(role.slug)
  return {
    title: `${role.name}专属 AI 工具 · ${role.tagline}`,
    description: role.description,
    keywords: [role.name, role.tagline, 'AI 工具推荐'].join(', '),
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: `${role.name} · ${role.tagline}`,
      description: role.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${role.name} · ${role.tagline}`,
      description: role.description,
    },
  }
}

export default async function RolePage({ params }: PageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const bundle = await getRoleBundleCached(slug)
  if (!bundle) notFound()
  const { role, tagCategories, matchedCategoryIds, tools } = bundle

  const navigation = await getNavigationMenuTreeStatic()

  const matchedCategories = matchedCategoryIds
    .map((id) => tagCategories.find((c) => c.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  const Icon = role.icon

  const siteUrl = getSiteUrl()
  const path = rolePublicPath(role.slug)

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${role.name} · ${role.tagline}`,
    url: `${siteUrl}${path}`,
    description: role.description,
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
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 md:h-12 md:w-12">
                  <Icon className="h-5 w-5 text-primary md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    角色专属 · {TAG_ROLES.length} 选 1
                  </p>
                  <h1 className="mt-0.5 text-xl font-bold text-foreground md:text-2xl">
                    {role.name}
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    {role.tagline}
                  </p>
                  <p className="mt-2 text-sm text-foreground/80">
                    {role.description}
                  </p>
                </div>
              </div>
            </div>

            {matchedCategories.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">关联场景：</span>
                {matchedCategories.map((c) => (
                  <Link key={c.id} href={tagCategoryPublicPath(c.slug)}>
                    <Badge variant="default">{c.name}</Badge>
                  </Link>
                ))}
              </div>
            )}

            {role.highlightedTagNames.length > 0 && (
              <div className="mb-6 rounded-xl border bg-card/50 p-4">
                <p className="mb-2 text-sm font-semibold">推荐标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.highlightedTagNames.map((name) => (
                    <Link key={name} href={tagPublicPath(name)}>
                      <Badge
                        variant="secondary"
                        className="hover:bg-primary hover:text-primary-foreground"
                      >
                        {name}
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
                  当前还没有打上该角色聚合分类标签的工具
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
