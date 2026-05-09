import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, User } from 'lucide-react'
import * as neon from '@/lib/neon/data'
import {
  loadAccountPortalBundle,
  portalFollowToolIds,
} from '@/lib/account-portal-bundle'
import { normalizePortalSections } from '@/lib/account-portal-section-defaults'
import { groupToolsForPortalStrip } from '@/lib/account-portal-group-tools'
import { AccountPortalBody } from '@/components/account-portal-body'
import { excellentSolutionsListPath } from '@/lib/account-portal-path'
import { Button } from '@/components/ui/button'

export const revalidate = 60
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const slugs = await neon.neonListApprovedShowcaseSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  const profile = slug
    ? await neon.neonGetProfileByShowcaseSlugPublic(slug)
    : null
  const title = profile?.showcase_title?.trim()
    ? profile.showcase_title.trim()
    : '解决方案'
  const desc =
    profile?.showcase_summary?.trim() ||
    '用户分享的 AI 工具与实践精选，由智选 AI 审核发布。'
  const path = `/excellent-ai-solutions/${encodeURIComponent(slug)}`
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: { type: 'article', url: path, title, description: desc },
    twitter: { card: 'summary_large_image', title, description: desc },
  }
}

export default async function ExcellentSolutionDetailPage({ params }: Props) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) notFound()

  const profile = await neon.neonGetProfileByShowcaseSlugPublic(slug)
  if (!profile) notFound()

  const bundle = await loadAccountPortalBundle(profile.id, {
    publicListedOnly: true,
  })
  const sections = normalizePortalSections(profile.portal_section_config)

  const followIdSet = portalFollowToolIds(bundle.followBlocks)
  const favTools = bundle.favoriteTools.filter((t) => !followIdSet.has(t.id))
  const subTools = bundle.submissionTools

  const ids = [
    ...new Set([
      ...followIdSet,
      ...favTools.map((t) => t.id),
      ...subTools.map((t) => t.id),
    ]),
  ]
  const { tagsByTool, rolesByTagId } =
    await neon.neonPortalTaxonomyMapsForTools(ids)

  const taxonomyOpts = {
    tagsByTool,
    rolesByTagId,
    scenesEnabled: bundle.scenesEnabled,
    rolesEnabled: bundle.rolesEnabled,
  }

  const favGroups = groupToolsForPortalStrip(favTools, taxonomyOpts)
  const submissionGroups = groupToolsForPortalStrip(subTools, taxonomyOpts)

  return (
    <div className="mx-auto min-h-screen max-w-[min(100%,94rem)] px-3 py-8 sm:px-6 md:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
        <Link href={excellentSolutionsListPath()}>
          <ArrowLeft className="h-4 w-4" />
          返回汇总
        </Link>
      </Button>

      <header className="mb-10 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-start">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <User className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            优秀 AI 解决方案
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {profile.showcase_title?.trim() || profile.display_name || '精选方案'}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {profile.showcase_summary?.trim() ||
              '作者在本站收录的工具与心得（仅展示已通过审核且前台可见的工具）。'}
          </p>
          <p className="text-sm text-muted-foreground">
            作者昵称：{profile.display_name?.trim() || '匿名'}
          </p>
        </div>
      </header>

      <AccountPortalBody
        portalTheme={profile.portal_theme}
        sections={sections}
        toolCardLinkMode="public"
        showSectionHeadings={false}
        followBlocks={bundle.followBlocks}
        favGroups={favGroups}
        submissionGroups={submissionGroups}
        comments={bundle.comments}
      />
    </div>
  )
}
