'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adminStripSceneTagsFromListedToolsBatchAction } from '@/app/admin/tag-categories/actions'
import { adminStripRoleTagsFromListedToolsBatchAction } from '@/app/admin/role-categories/actions'
import { adminSearchToolsForTaggingAction } from '@/app/admin/tools-tagging/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

type ToolHit = { id: string; name: string; slug: string }

type SelectionMode = 'single' | 'multi'

const SEARCH_DEBOUNCE_MS = 280

/** 从 tool_tags 摘掉本分类词条（场景：`tags.tag_category_id`；角色：本品 role_category_tags），其余标签保留。 */
export function AdminTaxonomyRemoveToolPanel({
  variant,
  taxonomyId,
  onListedBulk,
}: {
  variant: 'scene' | 'role'
  taxonomyId: string
  onListedBulk?: (m: Record<string, number>) => void
}) {
  const router = useRouter()
  const [submitPending, startSubmitTransition] = useTransition()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ToolHit[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  const [selectedById, setSelectedById] = useState<Map<string, ToolHit>>(
    () => new Map(),
  )
  const [searching, setSearching] = useState(false)

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
    const seq = ++searchSeq.current
    const timer = setTimeout(() => {
      ;(async () => {
        setSearching(true)
        try {
          const r = await adminSearchToolsForTaggingAction({
            query: q,
            onlyListedInTagCategoryId:
              variant === 'scene' ? taxonomyId : undefined,
            onlyListedInRoleCategoryId:
              variant === 'role' ? taxonomyId : undefined,
          })
          if (searchSeq.current !== seq) return
          if (!r.ok) {
            toast.error(r.error)
            setHits([])
            return
          }
          setHits(r.tools.map((t) => ({ id: t.id, name: t.name, slug: t.slug })))
        } finally {
          if (searchSeq.current === seq) setSearching(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [q, variant, taxonomyId])

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
          ? '请先选择一个工具'
          : '请至少勾选一个工具',
      )
      return
    }
    startSubmitTransition(async () => {
      const ids = selectedOrdered.map((h) => h.id)
      const r =
        variant === 'scene'
          ? await adminStripSceneTagsFromListedToolsBatchAction({
              tagCategoryId: taxonomyId,
              toolIds: ids,
            })
          : await adminStripRoleTagsFromListedToolsBatchAction({
              roleCategoryId: taxonomyId,
              toolIds: ids,
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
          ? '已从该工具移除本分类相关词条（其余 tool_tags 保留）'
          : `已对 ${ids.length} 个工具移除本分类相关词条`,
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

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        下列列表<strong className="text-foreground">仅展示已通过且未隐藏</strong>
        、且<strong className="text-foreground">至少挂有一条本分类词条</strong>
        的工具。提交后将从{' '}
        <code className="rounded bg-muted px-1 text-[11px]">tool_tags</code>{' '}
        中摘掉属于本分类的词条（场景：
        <code className="rounded bg-muted px-1 text-[11px]">
          tags.tag_category_id
        </code>
        ；角色：
        <code className="rounded bg-muted px-1 text-[11px]">
          role_category_tags
        </code>
        ）；<strong className="text-foreground">其它词条与其它分类挂载不受影响</strong>
        。
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[min(100%,240px)] flex-1 space-y-1">
          <Label htmlFor={`tax-rm-q-${taxonomyId}`} className="text-xs">
            搜索工具（实时筛选）
          </Label>
          <div className="relative">
            <Input
              id={`tax-rm-q-${taxonomyId}`}
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

      {hits.length > 0 ? (
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
                    {allHitsSelected ? '取消全选' : '全选当前列表'}
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

          <ul className="max-h-36 divide-y overflow-y-auto rounded-md border">
            {hits.map((h) => {
              const checked = selectedById.has(h.id)
              const rowId = `tax-rm-hit-${taxonomyId}-${h.id}`
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
        </div>
      ) : !searching ? (
        <p className="text-xs text-muted-foreground">
          {q.trim()
            ? '没有匹配的已挂载工具。'
            : '暂无已挂载本分类的已通过工具；或试试关键词筛选。'}
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
              个不在当前搜索结果里，仍会一并处理；修改关键词不会取消已选。
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        variant="destructive"
        disabled={submitPending || searching}
        onClick={() => submit()}
      >
        {submitPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
        {selectedOrdered.length > 1
          ? `移除本分类挂载（${selectedOrdered.length}）`
          : '移除本分类挂载'}
      </Button>
    </div>
  )
}
