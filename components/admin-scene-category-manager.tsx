'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  adminAssignTagToSceneCategoryAction,
  adminCreateSceneCategoryAction,
  adminSetSceneCategoryDisabledAction,
} from '@/app/admin/tag-categories/actions'
import { AdminTaxonomyAddToolPanel } from '@/components/admin-taxonomy-add-tool-panel'
import { AdminTaxonomyRemoveToolPanel } from '@/components/admin-taxonomy-remove-tool-panel'
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
import type { AdminTagRow, TagCategory } from '@/lib/types'
import { ChevronsUpDown, Trash2 } from 'lucide-react'

function canonSceneCatKey(id: string): string {
  return String(id).trim().toLowerCase()
}

function tagsCatKey(tc: string | null | undefined): string {
  if (tc == null || String(tc).trim() === '') return ''
  return canonSceneCatKey(tc)
}

function parseIsoMs(iso: string | null | undefined): number {
  if (iso == null || String(iso).trim() === '') return NaN
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? NaN : ms
}

function rowSceneSortMs(t: AdminTagRow): number {
  const linked = parseIsoMs(t.tag_category_linked_at)
  if (!Number.isNaN(linked)) return linked
  const created = parseIsoMs(t.created_at)
  return Number.isNaN(created) ? 0 : created
}

function compareSceneCategoryTagsNewestFirst(a: AdminTagRow, b: AdminTagRow): number {
  const tb = rowSceneSortMs(b)
  const ta = rowSceneSortMs(a)
  if (tb !== ta) return tb - ta
  return compareAdminTagRowByDisplayName(a, b)
}

function listedToolCountsEq(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  }
  return true
}

function CategoryBlock({
  cat,
  tagsInCat,
  pickerTags,
  listedTools,
  pending,
  onToggleDisabled,
  onAssignInto,
  onRemoveFromCat,
  onToolListedBulk,
}: {
  cat: TagCategory
  tagsInCat: AdminTagRow[]
  pickerTags: AdminTagRow[]
  /** 已通过且未隐藏、挂载本场景下启用标签的去重工具数（与首页一致） */
  listedTools: number
  pending: boolean
  onToggleDisabled: (disabled: boolean) => void
  onAssignInto: (tagId: string) => void
  onRemoveFromCat: (tagId: string) => void
  onToolListedBulk: (m: Record<string, number>) => void
}) {
  const [pickOpen, setPickOpen] = useState(false)
  const sortedIn = useMemo(
    () => [...tagsInCat].sort(compareSceneCategoryTagsNewestFirst),
    [tagsInCat],
  )
  const sortedPick = useMemo(
    () => [...pickerTags].sort(compareAdminTagRowByDisplayName),
    [pickerTags],
  )

  const disabledNow = Boolean(cat.is_disabled)

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
          <p className="text-xs text-muted-foreground">
            词条 {sortedIn.length} · 首页同款收录工具{' '}
            <span className="font-medium text-foreground tabular-nums">
              {listedTools}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">禁用</span>
          <Switch
            checked={disabledNow}
            disabled={pending}
            onCheckedChange={(v) => onToggleDisabled(v === true)}
            aria-label={`禁用分类 ${cat.name}`}
          />
        </div>
      </div>

      <Tabs defaultValue="tags" className="mt-3 w-full gap-2">
        <TabsList className="h-auto min-h-9 w-full min-w-0 flex-wrap justify-start gap-1">
          <TabsTrigger value="tags" className="px-2.5 text-[11px] sm:text-xs">
            关联标签
          </TabsTrigger>
          <TabsTrigger value="tools" className="px-2.5 text-[11px] sm:text-xs">
            挂载工具
          </TabsTrigger>
          <TabsTrigger value="unmount" className="px-2.5 text-[11px] sm:text-xs">
            移除挂载
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tags" className="mt-3 focus-visible:outline-none">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={pickOpen} onOpenChange={setPickOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="h-9 justify-between gap-2"
                >
                  将已有标签加入本分类…
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(420px,calc(100vw-3rem))] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索标签名称…" />
                  <CommandList>
                    <CommandEmpty>暂无可迁入的标签（可能已全部在本分类或未建标签）</CommandEmpty>
                    <CommandGroup heading="迁入到本分类">
                      {sortedPick.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={`${t.name} ${t.id}`}
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
              尚无标签挂载；可使用上方选择器迁入，或通过「新建标签」挂到本分类。
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
                      title="移出分类（不写库删标签）"
                      onClick={() => onRemoveFromCat(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="tools" className="mt-3 focus-visible:outline-none">
          <AdminTaxonomyAddToolPanel
            variant="scene"
            taxonomyId={cat.id}
            tagsInTaxonomy={tagsInCat}
            onListedBulk={onToolListedBulk}
          />
        </TabsContent>
        <TabsContent value="unmount" className="mt-3 focus-visible:outline-none">
          <AdminTaxonomyRemoveToolPanel
            variant="scene"
            taxonomyId={cat.id}
            onListedBulk={onToolListedBulk}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

export function AdminSceneCategoryManager({
  tagCategories,
  tags,
  publicListedToolsByTagCategoryId,
}: {
  tagCategories: TagCategory[]
  tags: AdminTagRow[]
  /** `tag_categories.id`（小写）→ 收录工具数，与首页「按场景」卡片一致 */
  publicListedToolsByTagCategoryId: Record<string, number>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  /** Server Action 已写入但 RSC refresh 尚未带上新列表时，用返回行覆盖展示 */
  const [tagRowPatchById, setTagRowPatchById] = useState<
    Record<string, AdminTagRow>
  >({})
  /** 迁入/迁出后立即套用服务端重算的收录工具数（整表），避免 Tab 加粗数落后于列表 */
  const [listedSnapshot, setListedSnapshot] = useState<Record<
    string,
    number
  > | null>(null)

  const tagsDisplay = useMemo(
    () => tags.map((t) => tagRowPatchById[t.id] ?? t),
    [tags, tagRowPatchById],
  )

  const listedEffective =
    listedSnapshot ?? publicListedToolsByTagCategoryId

  useEffect(() => {
    if (!listedSnapshot) return
    if (
      listedToolCountsEq(listedSnapshot, publicListedToolsByTagCategoryId)
    ) {
      setListedSnapshot(null)
    }
  }, [publicListedToolsByTagCategoryId, listedSnapshot])

  useEffect(() => {
    setTagRowPatchById((prev) => {
      if (Object.keys(prev).length === 0) return prev
      const next = { ...prev }
      let changed = false
      for (const id of Object.keys(next)) {
        const srv = tags.find((x) => x.id === id)
        const want = next[id]
        if (
          srv &&
          tagsCatKey(srv.tag_category_id) === tagsCatKey(want.tag_category_id)
        ) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [tags])

  const sortedCats = useMemo(
    () => [...tagCategories].sort((a, b) => a.sort_order - b.sort_order),
    [tagCategories],
  )

  const createCat = () => {
    const n = newName.normalize('NFKC').trim()
    if (!n) {
      toast.error('请输入场景分类名称')
      return
    }
    startTransition(async () => {
      const r = await adminCreateSceneCategoryAction({ name: n })
      if (!r.ok) {
        toast.error(r.error ?? '创建失败')
        return
      }
      toast.success('已新建场景分类')
      setNewName('')
      await router.refresh()
    })
  }

  const toggleDisabled = (id: string, next: boolean) => {
    startTransition(async () => {
      const r = await adminSetSceneCategoryDisabledAction({
        tagCategoryId: id,
        isDisabled: next,
      })
      if (!r.ok) {
        toast.error(r.error ?? '更新失败')
        return
      }
      toast.success(next ? '已禁用：首页与子页将不再展示该分类' : '已重新启用')
      await router.refresh()
    })
  }

  const assignInto = (tagId: string, categoryId: string) => {
    startTransition(async () => {
      const r = await adminAssignTagToSceneCategoryAction({
        tagId,
        tagCategoryId: categoryId,
      })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      setTagRowPatchById((p) => ({ ...p, [r.tag.id]: r.tag }))
      setListedSnapshot(r.publicListedToolsByTagCategoryId)
      toast.success('标签已归入该场景分类')
      await router.refresh()
    })
  }

  const removeFromCat = (tagId: string) => {
    startTransition(async () => {
      const r = await adminAssignTagToSceneCategoryAction({
        tagId,
        tagCategoryId: null,
      })
      if (!r.ok) {
        toast.error(r.error ?? '失败')
        return
      }
      setTagRowPatchById((p) => ({ ...p, [r.tag.id]: r.tag }))
      setListedSnapshot(r.publicListedToolsByTagCategoryId)
      toast.success('已移出该场景分类（标签仍保留）')
      await router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <Label htmlFor="new-scene-cat-name" className="text-sm font-medium">
          新建场景分类
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          名称站内唯一；URL slug 将自动生成。新建后在下方<strong>切换分类标签页</strong>挂载标签或禁用前台展示。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            id="new-scene-cat-name"
            value={newName}
            disabled={pending}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如：企业服务"
            className="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createCat()
              }
            }}
          />
          <Button
            type="button"
            onClick={() => createCat()}
            disabled={pending}
          >
            {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            创建
          </Button>
        </div>
      </section>

      {sortedCats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          暂无场景分类。可先使用上方表单新建，或由数据库迁移写入种子分类。
        </p>
      ) : (
        <>
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Tab 数字：</span>
            加粗为<strong className="text-foreground">收录工具数</strong>
            （已通过、未隐藏、至少挂载一条归属本场景且未禁用标签的去重工具数，与首页「按场景找
            AI」一致）；后方
            <span className="text-muted-foreground">「N词」</span>
            为本场景标签库中的<strong className="text-foreground">词条数</strong>（
            <code className="rounded bg-muted px-0.5">tags.tag_category_id</code>
            指向本场景的标签行数）。详情区「挂载工具 / 移除挂载」读写{' '}
            <code className="rounded bg-muted px-0.5 text-[11px]">tool_tags</code>
            ：挂载并入本分类启用词条；移除仅摘掉归属本场景的词条行。
          </p>
          <Tabs
          defaultValue={sortedCats[0]?.id}
          className="w-full gap-3"
        >
          <TabsList className="h-auto min-h-9 w-full min-w-0 flex-wrap justify-start gap-1 p-1 sm:justify-start">
            {sortedCats.map((cat) => {
              const tagRows = tagsDisplay.filter(
                (t) =>
                  t.tag_category_id != null &&
                  canonSceneCatKey(t.tag_category_id) ===
                    canonSceneCatKey(cat.id),
              ).length
              const listed =
                listedEffective[canonSceneCatKey(cat.id)] ?? 0
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex-none basis-auto max-w-[min(100%,240px)] shrink-0 px-2.5 py-1.5 text-left text-xs sm:text-sm"
                  title={`收录工具 ${listed}（首页「按场景」同款口径）· 词条 ${tagRows}（本场景标签库词条数）`}
                >
                  <span className="truncate">
                    {cat.name}
                    {cat.is_disabled ? (
                      <span className="ml-1 text-muted-foreground">·停</span>
                    ) : null}
                  </span>
                  <span className="ml-1 shrink-0 tabular-nums text-[10px] sm:text-[11px]">
                    <span className="font-semibold text-foreground">{listed}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">{tagRows}词</span>
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {sortedCats.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-0 focus-visible:outline-none">
              <CategoryBlock
                cat={cat}
                tagsInCat={tagsDisplay.filter(
                  (t) =>
                    t.tag_category_id != null &&
                    canonSceneCatKey(t.tag_category_id) ===
                      canonSceneCatKey(cat.id),
                )}
                pickerTags={tagsDisplay.filter(
                  (t) =>
                    t.tag_category_id == null ||
                    canonSceneCatKey(t.tag_category_id) !==
                      canonSceneCatKey(cat.id),
                )}
                listedTools={
                  listedEffective[canonSceneCatKey(cat.id)] ?? 0
                }
                pending={pending}
                onToggleDisabled={(v) => toggleDisabled(cat.id, v)}
                onAssignInto={(tagId) => assignInto(tagId, cat.id)}
                onRemoveFromCat={(tagId) => removeFromCat(tagId)}
                onToolListedBulk={(m) => setListedSnapshot(m)}
              />
            </TabsContent>
          ))}
        </Tabs>
        </>
      )}
    </div>
  )
}
