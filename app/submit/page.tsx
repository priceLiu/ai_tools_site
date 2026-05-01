import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompactAppSidebar } from '@/components/compact-app-sidebar'
import { Header } from '@/components/header'
import {
  SubmitToolForm,
  type EditingToolPayload,
} from '@/components/submit-tool-form'
import type { Category, Profile } from '@/lib/types'

type SubmitPageProps = {
  searchParams: Promise<{ edit?: string }>
}

export async function generateMetadata({ searchParams }: SubmitPageProps) {
  const { edit } = await searchParams
  return {
    title: edit ? '修改并重新提交 - AI工具集' : '提交工具 - AI工具集',
    description: '提交你发现的优质AI工具',
  }
}

export default async function SubmitPage({ searchParams }: SubmitPageProps) {
  const { edit: editId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const path = editId ? `/submit?edit=${editId}` : '/submit'
    redirect(`/auth/login?redirect=${encodeURIComponent(path)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  let editingTool: EditingToolPayload | undefined

  if (editId) {
    const { data: row } = await supabase
      .from('tools')
      .select(
        'id, slug, name, description, website_url, category_id, logo_url, screenshot_url, user_id, status',
      )
      .eq('id', editId)
      .maybeSingle()

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
    }
  }

  const cats = categories || []

  return (
    <div className="min-h-screen bg-background">
      <CompactAppSidebar />

      <div className="pl-52 md:pl-56">
        <Header user={user} profile={profile as Profile} />

        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">
                {editingTool ? '修改并重新提交' : '提交AI工具'}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {editingTool
                  ? '根据审核反馈修改信息后，将再次进入审核队列。'
                  : '分享你发现的优质AI工具，审核通过后将在网站展示'}
              </p>
            </div>

            <SubmitToolForm
              categories={cats as Category[]}
              userId={user.id}
              editingTool={editingTool}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
