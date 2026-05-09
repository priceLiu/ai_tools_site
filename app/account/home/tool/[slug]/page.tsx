import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolDetailPublicView } from '@/components/tool-detail-public-view'
import {
  toolDetailMaxWidthClass,
  toolDetailPageGutterClass,
} from '@/lib/tool-detail-layout'
import * as neon from '@/lib/neon/data'
import { getAuthUser } from '@/lib/auth/session'
import {
  accountPortalHomePath,
  accountPortalToolPath,
} from '@/lib/account-portal-path'

export const metadata = {
  title: '工具详情',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function AccountPortalToolPage({ params }: PageProps) {
  const user = await getAuthUser()
  if (!user) {
    redirect('/auth/login?redirect=/account/home')
  }

  const { slug: raw } = await params
  const slug = decodeURIComponent(raw ?? '').trim()
  if (!slug) notFound()

  const tool = await neon.neonGetToolForAccountPortal(slug, user.id)
  if (!tool) notFound()

  const sceneSummaries = await neon.neonListPublicSceneSummariesForTool(
    tool.id,
  )

  return (
    <div className={toolDetailPageGutterClass}>
      <div className={toolDetailMaxWidthClass}>
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
          <Link href={accountPortalHomePath()}>
            <ArrowLeft className="h-4 w-4" />
            返回个人主页
          </Link>
        </Button>

        <ToolDetailPublicView
          tool={tool}
          sceneSummaries={sceneSummaries}
          logoHref={accountPortalToolPath(tool.slug)}
        />
      </div>
    </div>
  )
}
