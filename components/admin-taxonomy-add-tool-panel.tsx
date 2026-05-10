'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adminAppendSceneTagsToListedToolsBatchAction } from '@/app/admin/tag-categories/actions'
import { adminAppendRoleTagsToListedToolsBatchAction } from '@/app/admin/role-categories/actions'
import { adminSearchToolsForTaggingAction } from '@/app/admin/tools-tagging/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  ADMIN_TAXONOMY_LIST_SCROLL_CLASS,
  ADMIN_TAXONOMY_TOOL_PAGE_SIZE,
} from '@/lib/admin-taxonomy-scroll'
import type { AdminTagRow } from '@/lib/types'

type ToolHit = { id: string; name: string; slug: string }

type SelectionMode = 'single' | 'multi'

const SEARCH_DEBOUNCE_MS = 280

export function AdminTaxonomyAddToolPanel({
  variant,
  taxonomyId,
  tagsInTaxonomy,
  onListedBulk,
}: {
  variant: 'scene' | 'role'
  taxonomyId: string
  tagsInTaxonomy: AdminTagRow[]
  /** 写入 tool_tags 后刷新 Tab 加粗「收录工具数」 */
  onListedBulk?: (m: Record<string, number>) => void
}) {
  const router = useRouter()
  const [submitPending, startSubmitTransition] = useTransition()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ToolHit[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  /** 勾选保留完整 ToolHit，不因搜索结果刷新或竞态变窄而从选中集合里丢掉 */
  const [selectedById, setSelectedById] = useState<Map<string, ToolHit>>(
    () => new Map(),
  )
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const enabledTagCount = useMemo(
    () => tagsInTaxonomy.filter((t) => !t.is_disabled).length,
    [tagsInTaxonomy],
  )

  const selectedOrdered = useMemo(
    () => [...selectedById.values()],
    [selectedById],
  )

  const hitIdSet = useMemo(() => new Set(hits.map((h) => h.id)), [hits])
  const selectedNotInHits = useMemo(
    () => selectedOrdered.filter((t) => !hitIdSet.has(t.id)),
    [selectedOrdered, hitIdSet],
  )

  const searchSeq = useRef(0)

  useEffect(() => {
    setPage(0)
  }, [q, variant, taxonomyId])

  useEffect(() => {
    if (total <= 0) return
    const maxPage = Math.max(
      0,
      Math.ceil(total / ADMIN_TAXONOMY_TOOL_PAGE_SIZE) - 1,
    )
    if (page > maxPage) setPage(maxPage)
  }, [total, page])

  useEffect(() => {
    const seq = ++searchSeq.current
    const timer = setTimeout(() => {
      ;(async () => {
        setSearching(true)
        try {
          const r = await adminSearchToolsForTaggingAction({
            query: q,
            limit: ADMIN_TAXONOMY_TOOL_PAGE_SIZE,
            offset: page * ADMIN_TAXONOMY_TOOL_PAGE_SIZE,
            excludeListedInTagCategoryId:
              variant === 'scene' ? taxonomyId : undefined,
            excludeListedInRoleCategoryId:
              variant === 'role' ? taxonomyId : undefined,
          })
          if (searchSeq.current !== seq) return
          if (!r.ok) {
            toast.error(r.error)
            setHits([])
            setTotal(0)
            return
          }
          setTotal(r.total)
          setHits(r.tools.map((t) => ({ id: t.id, name: t.name, slug: t.slug })))
        } finally {
          if (searchSeq.current === seq) setSearching(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [q, variant, taxonomyId, page])

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_TAXONOMY_TOOL_PAGE_SIZE))

  const toggleMulti = (h: ToolHit) => {
    setSelectedById((prev) => {
      const next = new Map(prev)
      if (next.has(h.id)) next.delete(h.id)
      else next.set(h.id, h)
      return next
    })
  }

  const selectSingle = (h: ToolHit) => {
    setSelectedById(new Map([[h.id, h]]))
  }

  const submit = () => {
    if (selectedOrdered.length === 0) {
      toast.error(
        selectionMode === 'single'
          ? '请先搜索并选择一个工具'
          : '请至少勾选一个工具',
      )
      return
    }
    startSubmitTransition(async () => {
      const ids = selectedOrdered.map((h) => h.id)
      const r =
        variant === 'scene'
          ? await adminAppendSceneTagsToListedToolsBatchAction({
              tagCategoryId: taxonomyId,
              toolIds: ids,
              tagIds: [],
            })
          : await adminAppendRoleTagsToListedToolsBatchAction({
              roleCategoryId: taxonomyId,
              toolIds: ids,
              tagIds: [],
            })

      if (!r.ok) {
        toast.error(r.error)
        return
      }

      if (variant === 'scene' && 'publicListedToolsByTagCategoryId' in r) {
        onListedBulk?.(r.publicListedToolsByTagCategoryId)
      } else if ('publicListedToolsByRoleCategoryId' in r) {
        onListedBulk?.(r.publicListedToolsByRoleCategoryId)
      }

      toast.success(
        ids.length === 1
          ? '已按本分类写入 tool_tags（合并原有顺序；单工具上限 20 枚，超出部分不会写入）'
          : `已对 ${ids.length} 个工具写入 tool_tags（各自合并顺序并受 20 枚上限）`,
      )
      setSelectedById(new Map())
      await router.refresh()
    })
  }

  const allHitsSelected =
    hits.length > 0 && hits.every((h) => selectedById.has(h.id))

  const toggleSelectAllHits = () => {
    if (allHitsSelected) {
      setSelectedById((prev) => {
        const next = new Map(prev)
        for (const h of hits) next.delete(h.id)
        return next
      })
      return
    }
    setSelectedById((prev) => {
      const next = new Map(prev)
      for (const h of hits) next.set(h.id, h)
      return next
    })
  }

  if (enabledTagCount === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
        当前分类下还没有可用的启用标签。请先到「
        <strong className="text-foreground">关联标签</strong>
        」维护词条后，再在此处挂载工具。
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        搜索<strong className="text-foreground">已通过且未隐藏</strong>
        的工具并选中后，一键把<strong className="text-foreground">本分类下全部启用词条</strong>
        按名字顺序并入该工具的{' '}
        <code className="rounded bg-muted px-1 text-[11px]">tool_tags</code>
        （保留原有标签在前；已达 20 枚时仅写入尚有空位的部分；不改词条的场景归属）。
        <span className="block pt-1">
          已通过挂载<strong className="text-foreground">本分类下任一词条</strong>
          的工具不再出现在候选列表（含词条已禁用）。
        </span>
      </p>

      <p className="text-[11px] leading-snug text-muted-foreground">
        下列列表按更新时间排序，支持<strong className="text-foreground">分页翻页</strong>
        遍历全部「尚可挂载」工具；亦可用关键词筛选。多选可跨页累积，提交时一并挂载。
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[min(100%,240px)] flex-1 space-y-1">
          <Label htmlFor={`tax-tool-q-${taxonomyId}`} className="text-xs">
            搜索工具（实时筛选）
          </Label>
          <div className="relative">
            <Input
              id={`tax-tool-q-${taxonomyId}`}
              value={q}
              disabled={submitPending}
              placeholder="名称或 slug，留空列出最近更新"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQ('')
              }}
              aria-busy={searching}
            />
            {searching ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                <Spinner className="h-4 w-4 text-muted-foreground" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {hits.length > 0 || total > 0 || searching ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">候选工具</Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">选择方式</span>
              <div className="flex rounded-md border border-border p-0.5">
                <button
                  type="button"
                  disabled={submitPending}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    selectionMode === 'single'
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => {
                    setSelectionMode('single')
                    setSelectedById((prev) => {
                      const first = [...prev.values()][0]
                      return first ? new Map([[first.id, first]]) : new Map()
                    })
                  }}
                >
                  单选
                </button>
                <button
                  type="button"
                  disabled={submitPending}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    selectionMode === 'multi'
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setSelectionMode('multi')}
                >
                  多选
                </button>
              </div>
              {selectionMode === 'multi' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={submitPending || hits.length === 0}
                    onClick={() => toggleSelectAllHits()}
                  >
                    {allHitsSelected ? '取消全选' : '全选当前页'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={submitPending || selectedById.size === 0}
                    onClick={() => setSelectedById(new Map())}
                  >
                    清空已选
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {hits.length > 0 ? (
            <ul className={ADMIN_TAXONOMY_LIST_SCROLL_CLASS}>
              {hits.map((h) => {
                const checked = selectedById.has(h.id)
                const rowId = `tax-hit-${taxonomyId}-${h.id}`
                if (selectionMode === 'single') {
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        disabled={submitPending}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/60 ${
                          checked ? 'bg-accent/40' : ''
                        }`}
                        onClick={() => selectSingle(h)}
                      >
                        <span className="font-medium">{h.name}</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {h.slug}
                        </span>
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={h.id}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent/40 ${
                        checked ? 'bg-accent/25' : ''
                      }`}
                    >
                      <Checkbox
                        id={rowId}
                        checked={checked}
                        disabled={submitPending}
                        onCheckedChange={() => toggleMulti(h)}
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-0.5 text-left text-sm leading-none"
                        onClick={() => toggleMulti(h)}
                      >
                        <span className="font-medium">{h.name}</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {h.slug}
                        </span>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : !searching ? (
            <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
              {total > 0
                ? '本页暂无行，请使用上一页/下一页或调整关键词。'
                : '暂无数据。'}
            </p>
          ) : (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          {!searching && total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                共 {total} 条
                {total > ADMIN_TAXONOMY_TOOL_PAGE_SIZE
                  ? ` · 第 ${page + 1} / ${totalPages} 页`
                  : null}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-[11px]"
                  disabled={submitPending || searching || page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-[11px]"
                  disabled={
                    submitPending ||
                    searching ||
                    (page + 1) * ADMIN_TAXONOMY_TOOL_PAGE_SIZE >= total
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : !searching ? (
        <p className="text-xs text-muted-foreground">
          {q.trim()
            ? '没有匹配的工具，可换个关键词试试。'
            : '暂无可挂载候选（可能均已挂上本分类词条）。'}
        </p>
      ) : null}

      {selectedOrdered.length > 0 ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            已选{' '}
            <span className="font-medium text-foreground">{selectedOrdered.length}</span>{' '}
            个工具
            {selectionMode === 'multi' && selectedOrdered.length <= 5 ? (
              <>
                ：{' '}
                {selectedOrdered.map((t) => t.name).join('、')}
              </>
            ) : null}
            {selectionMode === 'multi' && selectedOrdered.length > 5 ? (
              <span className="text-muted-foreground">
                （{selectedOrdered[0]?.name} 等）
              </span>
            ) : null}
          </p>
          {selectedNotInHits.length > 0 ? (
            <p className="text-[11px] leading-snug">
              其中{' '}
              <span className="font-medium text-foreground">
                {selectedNotInHits.length}
              </span>{' '}
              个不在当前页列表里，仍会一并挂载；翻页或改关键词不会取消已选。
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="button" disabled={submitPending || searching} onClick={() => submit()}>
        {submitPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
        {selectedOrdered.length > 1
          ? `挂载到本分类（${selectedOrdered.length}）`
          : '挂载到本分类'}
      </Button>
    </div>
  )
}
