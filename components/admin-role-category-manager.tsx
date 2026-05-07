'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  adminCreateRoleCategoryAction,
  adminLinkTagToRoleCategoryAction,
  adminSetRoleCategoryDisabledAction,
  adminUnlinkTagFromRoleCategoryAction,
} from '@/app/admin/role-categories/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { compareAdminTagRowByDisplayName } from '@/lib/tag-name-sort'
import type { AdminTagRow, RoleCategory } from '@/lib/types'
import { ChevronsUpDown, Trash2 } from 'lucide-react'

function RoleBlock({
  rc,
  tagsInRole,
  pickerTags,
  pending,
  onToggleDisabled,
  onAssignInto,
  onRemoveLink,
}: {
  rc: RoleCategory
  tagsInRole: AdminTagRow[]
  pickerTags: AdminTagRow[]
  pending: boolean
  onToggleDisabled: (disabled: boolean) => void
  onAssignInto: (tagId: string) => void
  onRemoveLink: (tagId: string) => void
}) {
  const [pickOpen, setPickOpen] = useState(false)
  const sortedIn = useMemo(
    () => [...tagsInRole].sort(compareAdminTagRowByDisplayName),
    [tagsInRole],
  )
  const sortedPick = useMemo(
    () => [...pickerTags].sort(compareAdminTagRowByDisplayName),
    [pickerTags],
  )

  const disabledNow = Boolean(rc.is_disabled)

  return (
    <section className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold md:text-lg">{rc.name}</h2>
            {disabledNow ? (
              <Badge variant="secondary" className="text-[10px]">
                已禁用 · 前台不展示
              </Badge>
            ) : null}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            slug: {rc.slug}
          </p>
          <p className="text-xs text-muted-foreground">
            本品通过 {sortedIn.length} 个关联标签聚合工具（不改标签的场景归属）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">禁用</span>
          <Switch
            checked={disabledNow}
            disabled={pending}
            onCheckedChange={(v) => onToggleDisabled(v === true)}
            aria-label={`禁用角色 ${rc.name}`}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Popover open={pickOpen} onOpenChange={setPickOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="h-9 justify-between gap-2"
            >
              将标签加入本品…
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(420px,calc(100vw-3rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder="搜索标签名称…" />
              <CommandList>
                <CommandEmpty>暂无未关联标签</CommandEmpty>
                <CommandGroup heading="勾选加入本品">
                  {sortedPick.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={t.name}
                      onSelect={() => {
                        setPickOpen(false)
                        onAssignInto(t.id)
                      }}
                    >
                      <span>{t.name}</span>
                      {t.category_name ? (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {t.category_name}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {sortedIn.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          尚无关联标签；本角色页的推荐标签与聚合工具均由关联标签推导。
        </p>
      ) : (
        <ul className="mt-3 max-h-[min(520px,55vh)] divide-y divide-border overflow-y-auto rounded-md border overscroll-contain">
          {sortedIn.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="font-medium">{t.name}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-xs text-muted-foreground">
                  工具数 {t.tool_count}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  className="h-8 w-8 shrink-0 text-destructive"
                  title="移出本品（不写库删标签）"
                  onClick={() => onRemoveLink(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AdminRoleCategoryManager({
  roleCategories,
  tags,
  links,
}: {
  roleCategories: RoleCategory[]
  tags: AdminTagRow[]
  links: { role_category_id: string; tag_id: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')

  const tagIdsByRoleId = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      if (!m.has(l.role_category_id)) {
        m.set(l.role_category_id, new Set())
      }
      m.get(l.role_category_id)!.add(l.tag_id)
    }
    return m
  }, [links])

  const sortedRoles = useMemo(
    () => [...roleCategories].sort((a, b) => a.sort_order - b.sort_order),
    [roleCategories],
  )

  const createRole = () => {
    const n = newName.normalize('NFKC').trim()
    if (!n) {
      toast.error('请输入角色名称')
      return
    }
    startTransition(async () => {
      const r = await adminCreateRoleCategoryAction({ name: n })
      if (!r.ok) {
        toast.error(r.error ?? '创建失败')
        return
      }
      toast.success('已新建角色分类')
      setNewName('')
      router.refresh()
    })
  }

  const toggleDisabled = (id: string, next: boolean) => {
    startTransition(async () => {
      const r = await adminSetRoleCategoryDisabledAction({
        roleCategoryId: id,
        isDisabled: next,
      })
      if (!r.ok) {
        toast.error(r.error ?? '更新失败')
        return
      }
      toast.success(next ? '已禁用：前台条带与子页将不再展示本品' : '已重新启用')
      router.refresh()
    })
  }

  const assignInto = (tagId: string, roleId: string) => {
    startTransition(async () => {
      const r = await adminLinkTagToRoleCategoryAction({
        roleCategoryId: roleId,
        tagId,
      })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success('标签已关联到该角色')
      router.refresh()
    })
  }

  const removeLink = (tagId: string, roleId: string) => {
    startTransition(async () => {
      const r = await adminUnlinkTagFromRoleCategoryAction({
        roleCategoryId: roleId,
        tagId,
      })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success('已移出关联（标签仍保留）')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <Label htmlFor="new-role-cat-name" className="text-sm font-medium">
          新建角色分类
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          名称站内唯一；URL slug 自动生成。新建后在下方切换标签页关联标签或禁用前台展示。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            id="new-role-cat-name"
            value={newName}
            disabled={pending}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如：产品经理"
            className="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createRole()
              }
            }}
          />
          <Button type="button" onClick={() => createRole()} disabled={pending}>
            {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            创建
          </Button>
        </div>
      </section>

      {sortedRoles.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          <p>暂无角色分类数据。</p>
          <p>
            · 可先使用上文「新建标签」建好词表后，在此处<strong>创建</strong>角色并迁入标签；或直接在下方输入名称点「创建」。
          </p>
          <p className="text-xs">
            · 若为全新库，请先执行迁移{' '}
            <code className="rounded bg-background px-1 text-foreground">
              20260506140000_role_categories.sql
            </code>{' '}
            +
            {' '}
            <code className="rounded bg-background px-1 text-foreground">
              20260506140100_seed_role_categories.sql
            </code>{' '}
            ，种子会写入 4 条默认角色与关联标签。
          </p>
        </div>
      ) : (
        <Tabs defaultValue={sortedRoles[0]?.id} className="w-full gap-3">
          <TabsList className="h-auto min-h-9 w-full min-w-0 flex-wrap justify-start gap-1 p-1 sm:justify-start">
            {sortedRoles.map((rc) => {
              const n = tagIdsByRoleId.get(rc.id)?.size ?? 0
              return (
                <TabsTrigger
                  key={rc.id}
                  value={rc.id}
                  className="max-w-[min(100%,240px)] shrink-0 basis-auto flex-none px-2.5 py-1.5 text-left text-xs sm:text-sm"
                  title={rc.name}
                >
                  <span className="truncate">
                    {rc.name}
                    {rc.is_disabled ? (
                      <span className="ml-1 text-muted-foreground">·停</span>
                    ) : null}
                  </span>
                  <span className="ml-1 shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    ({n})
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {sortedRoles.map((rc) => {
            const inSet = tagIdsByRoleId.get(rc.id) ?? new Set<string>()
            const tagsInRole = tags.filter((t) => inSet.has(t.id))
            const pickerTags = tags.filter((t) => !inSet.has(t.id))
            return (
              <TabsContent
                key={rc.id}
                value={rc.id}
                className="mt-0 focus-visible:outline-none"
              >
                <RoleBlock
                  rc={rc}
                  tagsInRole={tagsInRole}
                  pickerTags={pickerTags}
                  pending={pending}
                  onToggleDisabled={(v) => toggleDisabled(rc.id, v)}
                  onAssignInto={(tagId) => assignInto(tagId, rc.id)}
                  onRemoveLink={(tagId) => removeLink(tagId, rc.id)}
                />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
