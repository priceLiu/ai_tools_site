import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { ToolDetailPublicView } from '@/components/tool-detail-public-view'
import {
  toolDetailPageGutterClass,
  toolDetailMaxWidthClass,
} from '@/lib/tool-detail-layout'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'
import * as neon from '@/lib/neon/data'

/** 60s ISR：后台保存通过 `revalidatePath` 立即推送 */
export const revalidate = 60
export const dynamicParams = true

/** 同一请求内 generateMetadata 与 page 共享一次取数 */
const getToolBySlugCached = cache((slug: string) =>
  neon.neonGetToolPublicBySlug(slug),
)

interface ToolPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ admin_preview?: string }>
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

export async function generateMetadata({ params }: ToolPageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) return { title: '工具未找到 - AI工具集' }
  const tool = await getToolBySlugCached(slug)
  if (!tool) return { title: '工具未找到 - AI工具集' }
  const desc = (tool.description ?? '').trim()
  return {
    title: `${tool.name} - AI工具集`,
    description: desc || `了解 ${tool.name} 的功能与使用方式`,
  }
}

export default async function ToolPage({ params, searchParams }: ToolPageProps) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) notFound()

  const sp = await searchParams
  const hideCommentsForAdminPreview = sp.admin_preview === '1'

  const [tool, navigation] = await Promise.all([
    getToolBySlugCached(slug),
    getNavigationMenuTreeStatic(),
  ])

  if (!tool) notFound()

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

            <ToolDetailPublicView
              tool={tool}
              hideComments={hideCommentsForAdminPreview}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
