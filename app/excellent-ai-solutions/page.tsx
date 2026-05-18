import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import * as neon from '@/lib/neon/data'
import { excellentSolutionsListPath } from '@/lib/account-portal-path'
import { ExcellentShowcaseAvatarTile } from '@/components/excellent-showcase-avatar-tile'

/** 构建阶段（如 Docker 镜像）往往未注入 DATABASE_URL；避免预渲染时查库导致 build 失败。 */
export const dynamic = 'force-dynamic'

const SITE_SECTION_TITLE = 'AI 方案集'
const SITE_SECTION_DESC =
  '社区精选的 AI 工具组合与实践心得，由智选AI审核后在主站公开发布。'

export const metadata: Metadata = {
  title: SITE_SECTION_TITLE,
  description: SITE_SECTION_DESC,
  alternates: { canonical: excellentSolutionsListPath() },
  openGraph: {
    type: 'website',
    url: excellentSolutionsListPath(),
    title: SITE_SECTION_TITLE,
    description: SITE_SECTION_DESC,
  },
}

export default async function ExcellentSolutionsIndexPage() {
  const cards = await neon.neonListApprovedShowcaseCards()

  return (
    <main className="relative min-h-[70vh]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,hsl(var(--primary)/0.12),transparent_62%),linear-gradient(to_bottom,hsl(var(--muted)/0.3),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[min(100%,110rem)] px-3 pb-16 pt-3 sm:px-6 sm:pt-4 md:px-8">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary md:mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          返回首页
        </Link>
        <header className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {SITE_SECTION_TITLE}
          </h1>
        </header>

        {cards.length === 0 ? (
          <p className="mx-auto max-w-lg rounded-2xl border border-dashed border-border/80 bg-muted/25 px-6 py-16 text-center text-sm text-muted-foreground">
            暂无已发布的方案，敬请期待。
          </p>
        ) : (
          <ul className="mx-auto grid list-none grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:gap-3.5 xl:grid-cols-8">
            {cards.map((c, idx) => (
              <li key={c.slug} className="min-w-0">
                <ExcellentShowcaseAvatarTile
                  slug={c.slug}
                  title={c.title}
                  summary={c.summary}
                  displayName={c.display_name}
                  avatarUrl={c.avatar_url}
                  priority={idx < 16}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
