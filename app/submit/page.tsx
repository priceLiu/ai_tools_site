import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AccountChrome } from '@/components/account-chrome'
import {
  SubmitToolForm,
  type EditingToolPayload,
} from '@/components/submit-tool-form'
import { navigationMenuCategoryIdWhitelist } from '@/lib/submit-category-choices'
import { getNavigationMenuTree } from '@/lib/navigation-menu'
import type { Category, Profile, Tool } from '@/lib/types'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'
import { toolTagLabelsFromTool } from '@/lib/tool-tags-extract'
import { getSessionProfile } from '@/lib/server-profile'
import * as neon from '@/lib/neon/data'

type SubmitPageProps = {
  searchParams: Promise<{ edit?: string }>
}

export async function generateMetadata({ searchParams }: SubmitPageProps) {
  const { edit } = await searchParams
  return {
    title: edit ? '修改并重新提交 - AI工具集' : 'AI 工具提交 - AI工具集',
    description: '提交你发现的优质AI工具',
  }
}

export default async function SubmitPage({ searchParams }: SubmitPageProps) {
  const { edit: editId } = await searchParams
  const user = await getAuthUser()

  if (!user) {
    const path = editId ? `/submit?edit=${editId}` : '/submit'
    redirect(`/auth/login?redirect=${encodeURIComponent(path)}`)
  }

  const profile = await getSessionProfile(user.id)

  const [categories, navigation] = await Promise.all([
    neon.neonListCategoriesAll(),
    getNavigationMenuTree(),
  ])
  const cats = categories

  const whitelistCategoryIds = navigationMenuCategoryIdWhitelist(
    navigation,
    cats,
  )

  let editingTool: EditingToolPayload | undefined
  let orphanEditingCategory: Category | null = null

  if (editId) {
    let row: {
      id: string
      slug: string
      name: string
      description: string
      website_url: string
      category_id: string | null
      logo_url: string | null
      screenshot_url: string | null
      user_id: string | null
      status: string
      introduction: string | null
      introduction_format?: string
    } | null = null
    let toolForTags: Pick<Tool, 'tool_tags'> | null = null

    const t = await neon.neonGetToolForSubmitEdit(editId, user.id)
    if (t && t.user_id === user.id && t.status === 'rejected') {
      toolForTags = t
      row = {
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        website_url: t.website_url,
        category_id: t.category_id,
        logo_url: t.logo_url,
        screenshot_url: t.screenshot_url,
        user_id: t.user_id,
        status: t.status,
        introduction: t.introduction,
        introduction_format: t.introduction_format,
      }
    }

    if (!row || row.user_id !== user.id || row.status !== 'rejected') {
      redirect('/account/history')
    }

    editingTool = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      website_url: row.website_url,
      category_id: row.category_id,
      logo_url: row.logo_url,
      screenshot_url: row.screenshot_url,
      introduction: row.introduction,
      introduction_format: normalizeIntroductionFormat(
        (row as { introduction_format?: string }).introduction_format,
      ),
      initialTagNames: toolTagLabelsFromTool(toolForTags!),
    }
    const ec = cats.find((c) => c.id === row.category_id)
    if (
      ec &&
      whitelistCategoryIds &&
      !whitelistCategoryIds.has(ec.id)
    ) {
      orphanEditingCategory = ec
    }
  }

  return (
    <AccountChrome user={user} profile={profile as Profile}>
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {editingTool ? '修改并重新提交' : 'AI 工具提交'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {editingTool
              ? '根据审核反馈修改信息后，将再次进入审核队列。'
              : '分享你发现的优质AI工具，审核通过后将在网站展示'}
          </p>
        </div>

        <SubmitToolForm
          key={editingTool?.id ?? 'create'}
          categories={cats}
          navigation={navigation}
          whitelistCategoryIds={null}
          orphanEditingCategory={orphanEditingCategory}
          userId={user.id}
          editingTool={editingTool}
        />
      </div>
    </AccountChrome>
  )
}
