import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { UserSubmissionsList } from '@/components/user-submissions-list'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'
import type { Tool } from '@/lib/types'

interface AccountHistoryPageProps {
  searchParams: Promise<{ success?: string; resubmitted?: string }>
}

export const metadata = {
  title: '提交历史 - 个人中心',
}

export default async function AccountHistoryPage({
  searchParams,
}: AccountHistoryPageProps) {
  const { success, resubmitted } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: tools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const list = (tools as Tool[]) || []
  const favoriteCounts = await getFavoriteCountsByToolIds(
    supabase,
    list.map((t) => t.id),
  )

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">提交历史</h1>
          <p className="mt-1 text-muted-foreground">
            查看你提交过的所有工具及审核状态
          </p>
        </div>
        <Button asChild className="shrink-0 self-start">
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            提交新工具
          </Link>
        </Button>
      </div>

      {success === 'true' && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          工具提交成功！我们会尽快审核。
        </div>
      )}
      {resubmitted === 'true' && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          已重新提交审核，请耐心等待。
        </div>
      )}

      <UserSubmissionsList
        tools={list}
        favoriteCounts={favoriteCounts}
        emptyTitle="还没有提交记录"
        emptyDescription="提交你发现的优质 AI 工具，通过审核后即可在站点展示。"
      />
    </div>
  )
}
