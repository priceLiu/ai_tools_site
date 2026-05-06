'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  adminDeleteTagAction,
  adminMergeTagsAction,
  adminRenameTagAction,
  adminSetTagCuratedAction,
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
import type { AdminTagRow, TagCategory } from '@/lib/types'
import { Edit3, Merge, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'curated' | 'uncurated' | 'all'

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
  const [filterCategoryId, setFilterCategoryId] = useState<string>('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tags.filter((t) => {
      if (mode === 'curated' && !t.is_curated) return false
      if (mode === 'uncurated' && t.is_curated) return false
      if (filterCategoryId && t.tag_category_id !== filterCategoryId) return false
      if (kw) {
        const blob = `${t.name} ${(t.aliases ?? []).join(' ')}`.toLowerCase()
        if (!blob.includes(kw)) return false
      }
      return true
    })
  }, [tags, mode, keyword, filterCategoryId])

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

  const totalCurated = tags.filter((t) => t.is_curated).length
  const totalUncurated = tags.length - totalCurated
  const curatedToolLinks = tags
    .filter((t) => t.is_curated)
    .reduce((s, t) => s + t.tool_count, 0)
  const uncuratedToolLinks = tags
    .filter((t) => !t.is_curated)
    .reduce((s, t) => s + t.tool_count, 0)

  return (
    <div className="space-y-6">
      <Stats
        totalTags={tags.length}
        curated={totalCurated}
        uncurated={totalUncurated}
        curatedToolLinks={curatedToolLinks}
        uncuratedToolLinks={uncuratedToolLinks}
        categoriesCount={tagCategories.length}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card/50 p-3">
        <div>
          <Label className="text-xs">视图</Label>
          <div className="mt-1 inline-flex overflow-hidden rounded-md border">
            {(
              [
                ['curated', `Curated (${totalCurated})`],
                ['uncurated', `待清理 (${totalUncurated})`],
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

        <div>
          <Label htmlFor="tag-cat-filter" className="text-xs">
            分类筛选
          </Label>
          <select
            id="tag-cat-filter"
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">全部分类</option>
            {tagCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="">— 未分类 —</option>
          </select>
        </div>

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

      <div className="space-y-6">
        {tagCategories.map((cat) => {
          const list = grouped.get(cat.id) ?? []
          if (list.length === 0) return null
          return (
            <CategorySection
              key={cat.id}
              categoryName={cat.name}
              categorySlug={cat.slug}
              tags={list}
              tagCategories={tagCategories}
              router={router}
            />
          )
        })}

        {(grouped.get('unset')?.length ?? 0) > 0 && (
          <CategorySection
            key="unset"
            categoryName="未分类（可标 curated 并指定一级分类）"
            categorySlug={null}
            tags={grouped.get('unset') ?? []}
            tagCategories={tagCategories}
            router={router}
          />
        )}

        {filtered.length === 0 && (
          <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            没有匹配的标签
          </div>
        )}
      </div>
    </div>
  )
}

function Stats({
  totalTags,
  curated,
  uncurated,
  curatedToolLinks,
  uncuratedToolLinks,
  categoriesCount,
}: {
  totalTags: number
  curated: number
  uncurated: number
  curatedToolLinks: number
  uncuratedToolLinks: number
  categoriesCount: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[
        { label: '总标签数', value: totalTags },
        { label: 'Curated 标签', value: curated, hint: '受保护的官方词表' },
        { label: '待清理标签', value: uncurated, hint: '历史落库的非官方词' },
        {
          label: 'Curated 工具关联',
          value: curatedToolLinks,
          hint: '已挂在 curated 标签上的 tool_tags 数',
        },
        {
          label: '待清理工具关联',
          value: uncuratedToolLinks,
          hint: '挂在非 curated 标签上、需合并/重打的 tool_tags 数',
        },
        { label: '一级分类', value: categoriesCount },
      ].map((it) => (
        <div
          key={it.label}
          className="rounded-md border bg-card p-3 text-center"
        >
          <div className="text-2xl font-semibold tabular-nums">{it.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{it.label}</div>
          {it.hint && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">
              {it.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CategorySection({
  categoryName,
  categorySlug,
  tags,
  tagCategories,
  router,
}: {
  categoryName: string
  categorySlug: string | null
  tags: AdminTagRow[]
  tagCategories: TagCategory[]
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">{categoryName}</h2>
        <span className="text-xs text-muted-foreground">
          {tags.length} 个标签
        </span>
        {categorySlug && (
          <span className="text-xs text-muted-foreground">/ {categorySlug}</span>
        )}
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[80px] text-right">工具数</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead>别名</TableHead>
              <TableHead className="w-[280px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((t) => (
              <TagRowView
                key={t.id}
                row={t}
                tagCategories={tagCategories}
                allTags={tags}
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
  allTags,
  onChanged,
}: {
  row: AdminTagRow
  tagCategories: TagCategory[]
  allTags: AdminTagRow[]
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
      toast.success('已更新一级分类')
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
          <MergeDialog row={row} allTags={allTags} onChanged={onChanged} />

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
  allTags,
  onChanged,
}: {
  row: AdminTagRow
  allTags: AdminTagRow[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)
  const [keyword, setKeyword] = useState('')

  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allTags
      .filter((t) => t.id !== row.id)
      .filter((t) =>
        kw ? t.name.toLowerCase().includes(kw) : true,
      )
      .slice(0, 30)
  }, [allTags, keyword, row.id])

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
