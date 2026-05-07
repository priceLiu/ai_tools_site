'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  adminDeleteTagAction,
  adminMergeTagsAction,
  adminRenameTagAction,
  adminSetTagCuratedAction,
  adminSetTagDisabledAction,
} from '@/app/admin/tags/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { compareAdminTagRowByDisplayName } from '@/lib/tag-name-sort'
import type { AdminTagRow, TagCategory } from '@/lib/types'
import { Edit3, Merge, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'curated' | 'uncurated' | 'all' | 'disabled'

export function AdminTagsManager({
  tagCategories,
  tags,
}: {
  tagCategories: TagCategory[]
  tags: AdminTagRow[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('curated')
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tags.filter((t) => {
      if (mode === 'curated' && !t.is_curated) return false
      if (mode === 'uncurated' && t.is_curated) return false
      if (mode === 'disabled' && !t.is_disabled) return false
      if (kw) {
        const blob = `${t.name} ${(t.aliases ?? []).join(' ')}`.toLowerCase()
        if (!blob.includes(kw)) return false
      }
      return true
    })
  }, [tags, mode, keyword])

  const grouped = useMemo(() => {
    const m = new Map<string | 'unset', AdminTagRow[]>()
    for (const t of filtered) {
      const k = (t.tag_category_id ?? 'unset') as string | 'unset'
      const arr = m.get(k) ?? []
      arr.push(t)
      m.set(k, arr)
    }
    return m
  }, [filtered])

  const sortedCats = useMemo(
    () =>
      [...tagCategories].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN'),
      ),
    [tagCategories],
  )

  const tabKeys = useMemo(() => {
    const keys: string[] = []
    for (const cat of sortedCats) {
      if ((grouped.get(cat.id)?.length ?? 0) > 0) keys.push(cat.id)
    }
    if ((grouped.get('unset')?.length ?? 0) > 0) keys.push('unset')
    return keys
  }, [sortedCats, grouped])

  const effectiveTab = useMemo(() => {
    if (tabKeys.length === 0) return undefined
    if (activeTab != null && tabKeys.includes(activeTab)) return activeTab
    return tabKeys[0]
  }, [tabKeys, activeTab])

  const totalCurated = tags.filter((t) => t.is_curated).length
  const totalUncurated = tags.length - totalCurated
  const totalDisabled = tags.filter((t) => t.is_disabled).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card/50 p-3">
        <div>
          <Label className="text-xs">视图</Label>
          <div className="mt-1 inline-flex overflow-hidden rounded-md border">
            {(
              [
                ['curated', `Curated (${totalCurated})`],
                ['uncurated', `待清理 (${totalUncurated})`],
                ['disabled', `已禁用 (${totalDisabled})`],
                ['all', `全部 (${tags.length})`],
              ] as const
            ).map(([v, label]) => (
              <button
                type="button"
                key={v}
                onClick={() => setMode(v)}
                className={cn(
                  'px-3 py-1.5 text-sm transition-colors',
                  mode === v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="w-full basis-full text-xs text-muted-foreground">
          使用下方 <strong>场景分类 Tab</strong> 切换表格；视图（Curated / 待清理 /{' '}
          <strong>已禁用</strong> / 全部）与搜索对全库生效，仅有匹配结果的分类会出现 Tab。
        </p>

        <div className="min-w-[220px] flex-1">
          <Label htmlFor="tag-search" className="text-xs">
            搜索（名称 / 别名）
          </Label>
          <Input
            id="tag-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例如：图像 / 视频 / ppt"
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            没有匹配的标签
          </div>
        ) : !effectiveTab ? (
          <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            当前视图下暂无按分类可用的列表
          </div>
        ) : (
          <Tabs
            value={effectiveTab}
            onValueChange={setActiveTab}
            className="w-full gap-3"
          >
            <TabsList className="h-auto min-h-9 w-full min-w-0 flex-wrap justify-start gap-1 p-1">
              {sortedCats.map((cat) => {
                const n = grouped.get(cat.id)?.length ?? 0
                if (n === 0) return null
                return (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="flex-none basis-auto max-w-[min(100%,240px)] shrink-0 px-2.5 py-1.5 text-left text-xs sm:text-sm"
                    title={cat.name}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-1 shrink-0 tabular-nums text-[11px] text-muted-foreground">
                      ({n})
                    </span>
                  </TabsTrigger>
                )
              })}
              {(grouped.get('unset')?.length ?? 0) > 0 ? (
                <TabsTrigger
                  value="unset"
                  className="flex-none basis-auto px-2.5 py-1.5 text-left text-xs sm:text-sm"
                >
                  未分类
                  <span className="ml-1 tabular-nums text-[11px] text-muted-foreground">
                    ({grouped.get('unset')?.length ?? 0})
                  </span>
                </TabsTrigger>
              ) : null}
            </TabsList>

            {sortedCats.map((cat) => (
              <TabsContent
                key={cat.id}
                value={cat.id}
                className="mt-0 focus-visible:outline-none"
              >
                <CategorySection
                  categoryName={cat.name}
                  categorySlug={cat.slug}
                  tags={grouped.get(cat.id) ?? []}
                  mergeTargetPool={tags}
                  tagCategories={tagCategories}
                  router={router}
                />
              </TabsContent>
            ))}

            {(grouped.get('unset')?.length ?? 0) > 0 ? (
              <TabsContent value="unset" className="mt-0 focus-visible:outline-none">
                <CategorySection
                  categoryName="未分类（可标 curated 并指定场景分类）"
                  categorySlug={null}
                  tags={grouped.get('unset') ?? []}
                  mergeTargetPool={tags}
                  tagCategories={tagCategories}
                  router={router}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        )}
      </div>
    </div>
  )
}

function CategorySection({
  categoryName,
  categorySlug,
  tags,
  mergeTargetPool,
  tagCategories,
  router,
}: {
  categoryName: string
  categorySlug: string | null
  tags: AdminTagRow[]
  /** 合并时用全库标签候选（含 curated），避免仅能合并到本节内的行 */
  mergeTargetPool: AdminTagRow[]
  tagCategories: TagCategory[]
  router: ReturnType<typeof useRouter>
}) {
  const sortedTags = useMemo(
    () => [...tags].sort(compareAdminTagRowByDisplayName),
    [tags],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">{categoryName}</h2>
        <span className="text-xs text-muted-foreground">
          {sortedTags.length} 个标签
        </span>
        {categorySlug && (
          <span className="text-xs text-muted-foreground">/ {categorySlug}</span>
        )}
      </div>
      <div className="max-h-[min(560px,60vh)] overflow-auto rounded-md border bg-card overscroll-contain">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[80px] text-right">工具数</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[72px] text-center">前台</TableHead>
              <TableHead>别名</TableHead>
              <TableHead className="w-[280px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTags.map((t) => (
              <TagRowView
                key={t.id}
                row={t}
                tagCategories={tagCategories}
                mergeTargetPool={mergeTargetPool}
                onChanged={() => router.refresh()}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function TagRowView({
  row,
  tagCategories,
  mergeTargetPool,
  onChanged,
}: {
  row: AdminTagRow
  tagCategories: TagCategory[]
  mergeTargetPool: AdminTagRow[]
  onChanged: () => void
}) {
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)

  const toggleCurated = (next: boolean) => {
    setPending(true)
    startTransition(async () => {
      const r = await adminSetTagCuratedAction({
        tagId: row.id,
        isCurated: next,
        tagCategoryId: row.tag_category_id,
      })
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(next ? '已标为 Curated' : '已取消 Curated')
      onChanged()
    })
  }

  const setCategoryId = (categoryId: string | null) => {
    setPending(true)
    startTransition(async () => {
      const r = await adminSetTagCuratedAction({
        tagId: row.id,
        isCurated: row.is_curated,
        tagCategoryId: categoryId,
      })
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success('已更新场景分类')
      onChanged()
    })
  }

  const toggleTagDisabled = (isDisabled: boolean) => {
    setPending(true)
    startTransition(async () => {
      const r = await adminSetTagDisabledAction({
        tagId: row.id,
        isDisabled,
      })
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(isDisabled ? '已禁用：前台不再展示该标签' : '已重新启用标签')
      onChanged()
    })
  }

  const remove = () => {
    if (!confirm(`确认删除标签「${row.name}」？删除前需保证工具数为 0`)) return
    setPending(true)
    startTransition(async () => {
      const r = await adminDeleteTagAction(row.id)
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success('已删除')
      onChanged()
    })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-right tabular-nums">{row.tool_count}</TableCell>
      <TableCell>
        {row.is_curated ? (
          <Badge variant="default" className="gap-1">
            <Star className="h-3 w-3" /> Curated
          </Badge>
        ) : (
          <Badge variant="outline">待清理</Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.is_disabled !== true}
          disabled={pending}
          onCheckedChange={(checked) => toggleTagDisabled(!checked)}
          aria-label={`前台展示标签「${row.name}」`}
        />
      </TableCell>
      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
        {row.aliases.length > 0 ? row.aliases.join('、') : '—'}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select
            value={row.tag_category_id ?? ''}
            disabled={pending}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">未分类</option>
            {tagCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="sm"
            variant={row.is_curated ? 'outline' : 'default'}
            onClick={() => toggleCurated(!row.is_curated)}
            disabled={pending}
            className="h-8 gap-1"
          >
            {pending ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <Star className="h-3 w-3" />
            )}
            {row.is_curated ? '取消 Curated' : '标 Curated'}
          </Button>

          <RenameDialog row={row} onChanged={onChanged} />
          <MergeDialog
            row={row}
            mergeTargetPool={mergeTargetPool}
            onChanged={onChanged}
          />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending || row.tool_count > 0}
            onClick={remove}
            className="h-8 gap-1 text-destructive hover:text-destructive"
            title={row.tool_count > 0 ? '工具数不为 0' : '删除标签'}
          >
            <Trash2 className="h-3 w-3" />
            删除
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function RenameDialog({
  row,
  onChanged,
}: {
  row: AdminTagRow
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(row.name)
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)

  const submit = () => {
    setPending(true)
    startTransition(async () => {
      const r = await adminRenameTagAction({ tagId: row.id, newName: name })
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success('已重命名')
      setOpen(false)
      onChanged()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1">
          <Edit3 className="h-3 w-3" /> 改名
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重命名标签「{row.name}」</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="rename-tag-input" className="text-xs">
            新名称
          </Label>
          <Input
            id="rename-tag-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新标签名"
          />
          <p className="text-xs text-muted-foreground">
            如果新名称已存在另一个标签，需要使用「合并」而不是「改名」。
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Spinner className="mr-2 h-3 w-3" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MergeDialog({
  row,
  mergeTargetPool,
  onChanged,
}: {
  row: AdminTagRow
  mergeTargetPool: AdminTagRow[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)
  const [keyword, setKeyword] = useState('')

  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return mergeTargetPool
      .filter((t) => t.id !== row.id)
      .filter((t) =>
        kw ? t.name.toLowerCase().includes(kw) : true,
      )
      .slice(0, 30)
  }, [mergeTargetPool, keyword, row.id])

  const submit = () => {
    if (!targetId) {
      toast.error('请选择合并目标')
      return
    }
    if (
      !confirm(
        `确认把「${row.name}」上的 ${row.tool_count} 个工具合并到目标标签？源标签会被删除并写入 aliases。`,
      )
    )
      return
    setPending(true)
    startTransition(async () => {
      const r = await adminMergeTagsAction({
        sourceTagId: row.id,
        targetTagId: targetId,
      })
      setPending(false)
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      toast.success(`已合并（迁移 ${r.movedTools ?? 0} 个工具）`)
      setOpen(false)
      onChanged()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1">
          <Merge className="h-3 w-3" /> 合并
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>合并标签「{row.name}」到目标</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="搜索目标标签…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto rounded-md border bg-background">
            {candidates.length === 0 ? (
              <p className="p-3 text-center text-sm text-muted-foreground">
                未匹配
              </p>
            ) : (
              <ul className="divide-y">
                {candidates.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                      <input
                        type="radio"
                        name="merge-target"
                        checked={targetId === t.id}
                        onChange={() => setTargetId(t.id)}
                      />
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        工具 {t.tool_count}
                        {t.is_curated ? ' · curated' : ''}
                        {t.category_name ? ` · ${t.category_name}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            合并会把源标签上的所有工具关联迁到目标，且源标签的名称写入目标的 aliases，最后删除源标签。
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !targetId}
          >
            {pending ? <Spinner className="mr-2 h-3 w-3" /> : null}
            确认合并
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
