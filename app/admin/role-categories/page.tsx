import Link from 'next/link'
import * as neon from '@/lib/neon/data'
import { AdminRoleCategoryManager } from '@/components/admin-role-category-manager'
import { AdminRoleLinkBreakdown } from '@/components/admin-role-link-breakdown'
import { AdminRoleStatsCards } from '@/components/admin-role-stats-cards'
import { AdminTagCreateCard } from '@/components/admin-tag-create-card'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '角色管理 - 管理后台',
}

export const dynamic = 'force-dynamic'

export default async function AdminRoleCategoriesPage() {
  const [roleCategories, tagCategories, tags, links] = await Promise.all([
    neon.neonListRoleCategoriesAll(),
    neon.neonListTagCategoriesAll(),
    neon.neonAdminListTagsAll(),
    neon.neonListRoleCategoryTagLinks(),
  ])

  const rolesEnabled = roleCategories.filter((r) => !r.is_disabled).length
  const rolesDisabled = roleCategories.length - rolesEnabled
  const distinctLinkedTags = new Set(links.map((l) => l.tag_id)).size

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回管理后台
            </Link>
          </Button>
          <h1 className="mt-1 text-2xl font-bold">角色管理</h1>
          <p className="text-sm text-muted-foreground">
            管理首页「按角色」条带与{' '}
            <code className="rounded bg-muted px-1">/role/[slug]</code>{' '}
            ：与「场景分类管理」相同结构——本页统计、说明、新建标签、再进 Tabs 维护各角色；
            为角色关联标签只写联结，不改变标签的场景归属。
          </p>
        </div>
      </div>

      <AdminRoleStatsCards
        rolesTotal={roleCategories.length}
        rolesEnabled={rolesEnabled}
        rolesDisabled={rolesDisabled}
        roleTagLinks={links.length}
        distinctLinkedTags={distinctLinkedTags}
        totalTagsLibrary={tags.length}
      />

      <AdminRoleLinkBreakdown roles={roleCategories} links={links} />

      <Card className="mb-6 mt-6">
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
          <CardDescription className="space-y-1 text-xs leading-relaxed">
            <p>
              · 若统计与下方列表均为<strong>零</strong>，多半是<strong>尚未执行迁移</strong>，
              请运行{' '}
              <code className="rounded bg-muted px-1">
                20260506140000_role_categories.sql
              </code>{' '}
              与{' '}
              <code className="rounded bg-muted px-1">
                20260506140100_seed_role_categories.sql
              </code>{' '}
              后再刷新本页。
            </p>
            <p>
              · 「将标签加入本品」仅增加 role↔tag 联结；要改标签所属场景请在「标签管理」或「场景分类管理」操作。
            </p>
            <p>
              · 角色页的展示工具集 = 已审核工具 ∩ 任一关联标签；
              「新建标签」与场景分类管理页共用同一组件。
            </p>
            <p>
              · 图标 `icon` / 标语 `tagline` / 描述字段可按种子或通过 SQL 维护；需在后台表单编辑时再迭代即可。
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <div className="mb-6">
        <AdminTagCreateCard tagCategories={tagCategories} />
      </div>

      <AdminRoleCategoryManager
        roleCategories={roleCategories}
        tags={tags}
        links={links}
      />
    </div>
  )
}
