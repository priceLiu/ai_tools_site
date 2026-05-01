import { createClient } from '@/lib/supabase/server'
import { UserSubmissionsList } from '@/components/user-submissions-list'
import { getFavoriteCountsByToolIds } from '@/lib/favorite-counts'
import type { Tool } from '@/lib/types'

export const metadata = {
  title: '待审核的工具 - 个人中心',
}

export default async function AccountPendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: tools } = await supabase
    .from('tools')
    .select('*, category:categories(*)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const list = (tools as Tool[]) || []
  const favoriteCounts = await getFavoriteCountsByToolIds(
    supabase,
    list.map((t) => t.id),
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">待审核的工具</h1>
        <p className="mt-1 text-muted-foreground">
          以下内容正在等待管理员审核
        </p>
      </div>

      <UserSubmissionsList
        tools={list}
        favoriteCounts={favoriteCounts}
        emptyTitle="暂无待审核"
        emptyDescription="你没有正在审核中的工具提交，可以试试提交新站点。"
      />
    </div>
  )
}
