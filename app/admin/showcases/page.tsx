import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as neon from '@/lib/neon/data'
import { AdminShowcasesPanel } from '@/components/admin-showcases-panel'

export const metadata = {
  title: 'AI 方案集审核 - 管理后台',
}

export default async function AdminShowcasesPage() {
  const [pending, approved] = await Promise.all([
    neon.neonListShowcasePendingProfiles(),
    neon.neonListApprovedShowcasesAdmin(),
  ])

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            返回审核列表
          </Link>
        </Button>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          AI 方案集审核
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          用户从个人主页提交的公开发布申请将出现在「待审核」。同意后生成主站公开页并进入「AI
          方案集」汇总。
        </p>

        <AdminShowcasesPanel pending={pending} approved={approved} />
      </div>
    </div>
  )
}
