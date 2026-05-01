import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { UserSubmissionsList } from '@/components/user-submissions-list'
import { filterOwnTools } from '@/lib/filter-own-tools'
import type { Tool } from '@/lib/types'

interface AccountHistoryPageProps {
  searchParams: Promise<{ success?: string; resubmitted?: string; q?: string }>
}

export const metadata = {
  title: '工具提交历史 - 个人中心',
}

export default async function AccountHistoryPage({
  searchParams,
}: AccountHistoryPageProps) {
  const { success, resubmitted, q: queryParam } = await searchParams
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
  const hasQuery = Boolean(queryParam?.trim())
  const filtered = filterOwnTools(list, queryParam)

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工具提交历史</h1>
          <p className="mt-1 text-muted-foreground">
            查看你提交过的所有工具及审核状态
          </p>
        </div>
        <Button asChild className="shrink-0 self-start">
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            AI 工具提交
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

      {hasQuery ? (
        <p className="mb-4 text-sm text-muted-foreground">
          在你提交的全部工具中搜索「{queryParam!.trim()}」：找到 {filtered.length}{' '}
          条
        </p>
      ) : null}

      <UserSubmissionsList
        tools={filtered}
        emptyTitle={
          hasQuery ? '没有匹配的提交' : '还没有提交记录'
        }
        emptyDescription={
          hasQuery
            ? '换个关键词试试，或前往「审核中的工具」查看待审条目。'
            : '提交你发现的优质 AI 工具，通过审核后即可在站点展示。'
        }
      />
    </div>
  )
}
