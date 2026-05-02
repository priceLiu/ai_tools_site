import { createClient } from '@/lib/supabase/server'
import { UserSubmissionsList } from '@/components/user-submissions-list'
import { filterOwnTools } from '@/lib/filter-own-tools'
import type { Tool } from '@/lib/types'

export const metadata = {
  title: '审核中的工具 - 个人中心',
}

interface AccountPendingPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AccountPendingPage({
  searchParams,
}: AccountPendingPageProps) {
  const { q: queryParam } = await searchParams
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
  const hasQuery = Boolean(queryParam?.trim())
  const filtered = filterOwnTools(list, queryParam)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">审核中的工具</h1>
        <p className="mt-1 text-muted-foreground">
          以下内容正在等待管理员审核
        </p>
      </div>

      {hasQuery ? (
        <p className="mb-4 text-sm text-muted-foreground">
          在审核中的工具里搜索「{queryParam!.trim()}」：找到 {filtered.length}{' '}
          条
        </p>
      ) : null}

      <UserSubmissionsList
        tools={filtered}
        emptyTitle={
          hasQuery ? '没有匹配的待审核工具' : '暂无审核中的工具'
        }
        emptyDescription={
          hasQuery
            ? '没有名称或工具介绍包含该关键词的待审核条目。可在「工具提交历史」中搜索全部状态。'
            : '你没有正在审核中的工具提交，可以试试「AI 工具提交」。'
        }
      />
    </div>
  )
}
