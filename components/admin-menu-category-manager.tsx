'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  adminAddToolToHotFeaturedAction,
  adminCreateMenuCategoryAction,
  adminDeleteMenuCategoryAction,
  adminLinkToolToMenuCategoryAction,
  adminRemoveToolFromHotFeaturedAction,
  adminSearchToolsForHotPickerAction,
  adminSearchToolsNotInMenuCategoryAction,
  adminSetMenuCategoryDisabledAction,
  adminUnlinkToolFromMenuCategoryAction,
} from '@/app/admin/menu-categories/actions'
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { idsEqual } from '@/lib/category-tree'
import type { Category } from '@/lib/types'
import { ChevronsUpDown, Trash2 } from 'lucide-react'

export type MenuCategoryToolMembershipRow = {
  category_id: string
  tool_id: string
  name: string
  slug: string
  status: string
  is_disabled: boolean
  view_count: number | null
}

/** 统一 UUID 字符串形式 */
function canonUuid(id: string): string {
  return String(id).trim().toLowerCase()
}

function MenuCategoryToolsBlock({
  cat,
  toolsInCat,
  pending,
  parentLabel,
  childCategoryCount,
  onToggleDisabled,
  onAssignTool,
  onRemoveTool,
  onDeleteCategory,
}: {
  cat: Category
  toolsInCat: MenuCategoryToolMembershipRow[]
  pending: boolean
  parentLabel: string | null
  childCategoryCount: number
  onToggleDisabled: (disabled: boolean) => void
  onAssignTool: (toolId: string) => void
  onRemoveTool: (toolId: string) => void
  onDeleteCategory: () => void
}) {
  const [pickOpen, setPickOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pickQuery, setPickQuery] = useState('')
  const [pickBusy, setPickBusy] = useState(false)
  const [pickCandidates, setPickCandidates] = useState<
    { id: string; name: string; slug: string }[]
  >([])

  const isHotSlug = (cat.slug ?? '').trim() === 'hot'

  useEffect(() => {
    if (!pickOpen) return
    let cancelled = false
    const delay = pickQuery.trim().length > 0 ? 280 : 0
    const run = async () => {
      setPickBusy(true)
      const r =
        isHotSlug
          ? await adminSearchToolsForHotPickerAction({ query: pickQuery })
          : await adminSearchToolsNotInMenuCategoryAction({
              categoryId: cat.id,
              query: pickQuery,
            })
      if (cancelled) return
      setPickBusy(false)
      if (!r.ok || !r.tools) {
        setPickCandidates([])
        if (!r.ok && r.error) toast.error(r.error)
        return
      }
      setPickCandidates(r.tools)
    }
    const t = window.setTimeout(run, delay)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [pickOpen, pickQuery, cat.id, cat.slug, isHotSlug])

  useEffect(() => {
    if (!pickOpen) setPickQuery('')
  }, [pickOpen])

  const disabledNow = Boolean(cat.is_disabled)
  const totalMounted = toolsInCat.length
  const publicListed = toolsInCat.filter(
    (r) => r.status === 'approved' && !r.is_disabled,
  ).length

  const summaryLine = isHotSlug
      ? `下列 ${totalMounted} 个工具与首页「热门工具」区块一致（is_featured · 已通过 · 未隐藏），可直接在此取消热门或添加更多`
      : `前台可见 ${publicListed} 个（已通过且未隐藏）；后台挂载 ${totalMounted} 条`

  const deleteBlockedReason = isHotSlug
    ? '热门产品线不可删除'
    : childCategoryCount > 0
      ? `仍有 ${childCategoryCount} 个子分类，请先处理子分类`
      : toolsInCat.length > 0
        ? '请先移除本分类下的工具挂载'
        : null

  return (
    <section className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold md:text-lg">{cat.name}</h2>
            {disabledNow ? (
              <Badge variant="secondary" className="text-[10px]">
                已禁用 · 前台不展示
              </Badge>
            ) : null}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            slug: {cat.slug}
          </p>
          {parentLabel ? (
            <p className="text-xs text-muted-foreground">父分类：{parentLabel}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{summaryLine}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isHotSlug ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || deleteBlockedReason != null}
                title={deleteBlockedReason ?? '从数据库删除该分类（categories）'}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                删除分类
              </Button>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      删除菜单分类「{cat.name}」？
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          将删除{' '}
                          <span className="font-mono text-foreground">
                            categories
                          </span>{' '}
                          中 slug 为{' '}
                          <span className="font-mono text-foreground">
                            {cat.slug}
                          </span>{' '}
                          的一行；{' '}
                          <span className="font-mono text-foreground">
                            category_tags
                          </span>{' '}
                          等联结会一并删除。若「菜单管理」里仍有指向{' '}
                          <span className="font-mono">
                            /category/{cat.slug}
                          </span>{' '}
                          的链接，请自行清理以免死链。
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">取消</AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        setDeleteDialogOpen(false)
                        onDeleteCategory()
                      }}
                    >
                      确认删除
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
          <span className="text-xs text-muted-foreground">禁用</span>
          <Switch
            checked={disabledNow}
            disabled={pending}
            onCheckedChange={(v) => onToggleDisabled(v === true)}
            aria-label={`禁用产品线 ${cat.name}`}
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
              {isHotSlug ? '加入首页热门…' : '挂载已有工具…'}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(420px,calc(100vw-3rem))] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="按名称或 slug 搜索（留空则按热度列出候选）…"
                value={pickQuery}
                onValueChange={setPickQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {pickBusy
                    ? '加载中…'
                    : isHotSlug
                      ? '当前已全部设为热门或没有候选工具'
                      : '没有匹配或未挂载在本类的工具'}
                </CommandEmpty>
                <CommandGroup heading={isHotSlug ? '设为首页热门' : '加入本菜单分类'}>
                  {pickCandidates.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={`${t.name} ${t.slug}`}
                      onSelect={() => {
                        setPickOpen(false)
                        onAssignTool(t.id)
                      }}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="ml-auto truncate pl-2 font-mono text-[10px] text-muted-foreground">
                        {t.slug}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {toolsInCat.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {isHotSlug
            ? '尚无设为热门的工具；可用上方选择器添加（勾选 is_featured）。移除仅从本条产品线语义等价于取消首页热门。'
            : '尚无工具挂载；可用上方选择器添加。仅从本条移除不会删除工具记录，其它菜单分类下的挂载不受影响。'}
        </p>
      ) : (
        <ul className="mt-3 max-h-[min(520px,55vh)] divide-y divide-border overflow-y-auto rounded-md border overscroll-contain">
          {toolsInCat.map((row) => (
            <li
              key={row.tool_id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/tools/${row.tool_id}`}
                    className="font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.is_disabled ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      已隐藏
                    </Badge>
                  ) : row.status !== 'approved' ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {row.status}
                    </Badge>
                  ) : null}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {row.slug}
                  <span className="ml-2 tabular-nums">· {row.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {row.view_count != null ? (
                  <span className="tabular-nums text-xs text-muted-foreground">
                    访问 {row.view_count}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  className="h-8 w-8 shrink-0 text-destructive"
                  title={
                    isHotSlug
                      ? '取消首页热门（关闭 is_featured）'
                      : '仅从本条菜单分类移除（不删工具）'
                  }
                  onClick={() => onRemoveTool(row.tool_id)}
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

export function AdminMenuCategoryManager({
  categories,
  memberships,
  tabBadgeByCategoryId,
  featuredToolsPublicCount,
}: {
  categories: Category[]
  memberships: MenuCategoryToolMembershipRow[]
  tabBadgeByCategoryId: Record<string, number>
  featuredToolsPublicCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [parentId, setParentId] = useState<string>('')

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const toolsByCategoryId = useMemo(() => {
    const m = new Map<string, MenuCategoryToolMembershipRow[]>()
    for (const row of memberships) {
      const cid = canonUuid(row.category_id)
      if (!m.has(cid)) m.set(cid, [])
      m.get(cid)!.push(row)
    }
    return m
  }, [memberships])

  const sortedCats = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, 'zh-Hans-CN'),
      ),
    [categories],
  )

  const createCat = () => {
    const n = newName.normalize('NFKC').trim()
    if (!n) {
      toast.error('请输入分类名称')
      return
    }
    const pid = parentId.trim()
    startTransition(async () => {
      const r = await adminCreateMenuCategoryAction({
        name: n,
        parentId: pid.length > 0 ? pid : null,
      })
      if (!r.ok) {
        toast.error(r.error ?? '创建失败')
        return
      }
      toast.success('已新建菜单分类')
      setNewName('')
      setParentId('')
      router.refresh()
    })
  }

  const toggleDisabled = (id: string, next: boolean) => {
    startTransition(async () => {
      const r = await adminSetMenuCategoryDisabledAction({
        categoryId: id,
        isDisabled: next,
      })
      if (!r.ok) {
        toast.error(r.error ?? '更新失败')
        return
      }
      toast.success(next ? '已禁用：前台分类页与导航入口隐藏' : '已重新启用')
      router.refresh()
    })
  }

  const assignTool = (toolId: string, categoryId: string) => {
    const catRow = categories.find((c) => c.id === categoryId)
    const hot = (catRow?.slug ?? '').trim() === 'hot'
    startTransition(async () => {
      const r = hot
        ? await adminAddToolToHotFeaturedAction({
            hotCategoryId: categoryId,
            toolId,
          })
        : await adminLinkToolToMenuCategoryAction({ categoryId, toolId })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(hot ? '已加入首页热门' : '已挂载到本条菜单分类')
      router.refresh()
    })
  }

  const removeTool = (toolId: string, categoryId: string) => {
    const catRow = categories.find((c) => c.id === categoryId)
    const hot = (catRow?.slug ?? '').trim() === 'hot'
    startTransition(async () => {
      const r = hot
        ? await adminRemoveToolFromHotFeaturedAction({
            hotCategoryId: categoryId,
            toolId,
          })
        : await adminUnlinkToolFromMenuCategoryAction({ categoryId, toolId })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(
        hot
          ? '已取消首页热门'
          : '已从本条移除（工具与其它分类挂载保留）',
      )
      router.refresh()
    })
  }

  const deleteCategory = (categoryId: string) => {
    startTransition(async () => {
      const r = await adminDeleteMenuCategoryAction({ categoryId })
      if (!r.ok) {
        toast.error(r.error ?? '删除失败')
        return
      }
      toast.success('已删除菜单分类')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <Label htmlFor="new-menu-cat-name" className="text-sm font-medium">
          新建菜单分类
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          名称站内唯一；slug 自动生成。可选择父分类（留空为根级）。
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">名称</Label>
            <Input
              id="new-menu-cat-name"
              value={newName}
              disabled={pending}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：垂直行业"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  createCat()
                }
              }}
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">父分类（可选）</Label>
            <select
              value={parentId}
              disabled={pending}
              onChange={(e) => setParentId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">根分类（无父级）</option>
              {sortedCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => createCat()} disabled={pending}>
            {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            创建
          </Button>
        </div>
      </section>

      {sortedCats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          暂无产品线分类数据。
        </p>
      ) : (
        <Tabs defaultValue={sortedCats[0]?.id} className="w-full gap-3">
          <TabsList className="h-auto min-h-9 w-full min-w-0 flex-wrap justify-start gap-1 p-1 sm:justify-start">
            {sortedCats.map((cat) => {
              const cid = canonUuid(cat.id)
              const fallbackPublic = (toolsByCategoryId.get(cid) ?? []).filter(
                (r) => r.status === 'approved' && !r.is_disabled,
              ).length
              const n =
                (cat.slug ?? '').trim() === 'hot'
                  ? featuredToolsPublicCount
                  : tabBadgeByCategoryId[cid] ?? fallbackPublic
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex-none basis-auto max-w-[min(100%,240px)] shrink-0 px-2.5 py-1.5 text-left text-xs sm:text-sm"
                  title={cat.name}
                >
                  <span className="truncate">
                    {cat.name}
                    {cat.is_disabled ? (
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
          {sortedCats.map((cat) => {
            const cid = canonUuid(cat.id)
            const toolsInCat = toolsByCategoryId.get(cid) ?? []
            const pid = cat.parent_id?.trim()
            const parentLabel =
              pid && catById.has(pid) ? catById.get(pid)!.name : null
            const childCategoryCount = categories.filter((c) =>
              idsEqual(c.parent_id, cat.id),
            ).length

            return (
              <TabsContent
                key={cat.id}
                value={cat.id}
                className="mt-0 focus-visible:outline-none"
              >
                <MenuCategoryToolsBlock
                  cat={cat}
                  toolsInCat={toolsInCat}
                  pending={pending}
                  parentLabel={parentLabel}
                  childCategoryCount={childCategoryCount}
                  onToggleDisabled={(v) => toggleDisabled(cat.id, v)}
                  onAssignTool={(toolId) => assignTool(toolId, cat.id)}
                  onRemoveTool={(toolId) => removeTool(toolId, cat.id)}
                  onDeleteCategory={() => deleteCategory(cat.id)}
                />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
