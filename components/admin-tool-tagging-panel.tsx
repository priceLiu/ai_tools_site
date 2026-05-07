'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  adminGetToolTagsForEditorAction,
  adminListRoleCategoryTagsPickerAction,
  adminSearchTagsForPickerAction,
  adminSearchToolsForTaggingAction,
} from '@/app/admin/tools-tagging/actions'
import { setToolTagsAction } from '@/app/actions/tool-tags'
import type { AdminTagPickerRow } from '@/lib/neon/data'
import type { RoleCategory, TagCategory } from '@/lib/types'
import { TOOL_TAGS_MAX } from '@/lib/tool-tags-extract'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ChevronsUpDown, FolderTree, Plus, Tag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagCategoryPublicPath } from '@/lib/tag-slug'

const ROLE_NONE = '__none__'

const SCENE_FILTER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 写入草稿时的场景挂载：与首页 `tool_tags` → `tags.tag_category_id` 一致 */
function sceneAwareTagCategoryHint(
  row: AdminTagPickerRow,
  sceneFilter: string,
): string | null | undefined {
  if (sceneFilter === 'uncategorized') return null
  if (SCENE_FILTER_UUID_RE.test(sceneFilter)) {
    return row.tag_category_id ?? sceneFilter.trim().toLowerCase()
  }
  return row.tag_category_id ?? undefined
}

type DraftTag = { name: string; tag_category_id?: string | null }

function canonSceneKey(id: string): string {
  return String(id).trim().toLowerCase()
}

/** 推导单行草稿的场景 id（与保存时 tagCategoryHints 语义对齐：选定具体场景则默认归入该场景） */
function resolvedTagCategoryIdForRow(
  row: DraftTag,
  sceneFilter: string,
): string | null {
  const sf = sceneFilter.trim()
  const explicit = row.tag_category_id?.trim().toLowerCase()
  if (explicit) return explicit
  if (SCENE_FILTER_UUID_RE.test(sf)) return sf.toLowerCase()
  return null
}

type SelectedTool = {
  id: string
  name: string
  slug: string
  status: string
}

export function AdminToolTaggingPanel({
  tagCategories,
  roleCategories,
}: {
  tagCategories: TagCategory[]
  roleCategories: RoleCategory[]
}) {
  const [toolPickOpen, setToolPickOpen] = useState(false)
  const [toolQuery, setToolQuery] = useState('')
  const [toolBusy, setToolBusy] = useState(false)
  const [toolCandidates, setToolCandidates] = useState<
    { id: string; name: string; slug: string; status: string }[]
  >([])

  const [selectedTool, setSelectedTool] = useState<SelectedTool | null>(null)
  const [draftTags, setDraftTags] = useState<DraftTag[]>([])
  const [loadingTagsForTool, setLoadingTagsForTool] = useState(false)

  const [sceneFilter, setSceneFilter] = useState<string>('all')
  const [rolePickValue, setRolePickValue] = useState<string>(ROLE_NONE)
  const [roleTags, setRoleTags] = useState<AdminTagPickerRow[]>([])
  const [roleTagsBusy, setRoleTagsBusy] = useState(false)

  const [tagPickOpen, setTagPickOpen] = useState(false)
  const [tagPickQuery, setTagPickQuery] = useState('')
  const [tagPickBusy, setTagPickBusy] = useState(false)
  const [tagCandidates, setTagCandidates] = useState<AdminTagPickerRow[]>([])

  const [savePending, startSaveTransition] = useTransition()

  const sceneSelectItems = useMemo(
    () =>
      [...tagCategories].sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [tagCategories],
  )

  const draftResolvedSceneIds = useMemo(() => {
    const s = new Set<string>()
    for (const d of draftTags) {
      const cid = resolvedTagCategoryIdForRow(d, sceneFilter)
      if (cid) s.add(cid)
    }
    return s
  }, [draftTags, sceneFilter])

  const draftSceneSummaries = useMemo(() => {
    if (draftResolvedSceneIds.size === 0) return []
    return [...tagCategories]
      .filter((c) => draftResolvedSceneIds.has(canonSceneKey(c.id)))
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name, 'zh-CN'),
      )
  }, [draftResolvedSceneIds, tagCategories])

  const draftOrphanSceneIds = useMemo(() => {
    const known = new Set(tagCategories.map((c) => canonSceneKey(c.id)))
    return [...draftResolvedSceneIds].filter((id) => !known.has(id))
  }, [draftResolvedSceneIds, tagCategories])

  useEffect(() => {
    if (!toolPickOpen) return
    let cancelled = false
    const delay = toolQuery.trim().length > 0 ? 280 : 0
    const run = async () => {
      setToolBusy(true)
      const r = await adminSearchToolsForTaggingAction({ query: toolQuery })
      if (cancelled) return
      setToolBusy(false)
      if (!r.ok) {
        setToolCandidates([])
        toast.error(r.error)
        return
      }
      setToolCandidates(r.tools)
    }
    const t = window.setTimeout(run, delay)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [toolPickOpen, toolQuery])

  useEffect(() => {
    if (!toolPickOpen) setToolQuery('')
  }, [toolPickOpen])

  useEffect(() => {
    if (!tagPickOpen) return
    let cancelled = false
    const delay = tagPickQuery.trim().length > 0 ? 280 : 120
    const run = async () => {
      setTagPickBusy(true)
      const r = await adminSearchTagsForPickerAction({
        query: tagPickQuery,
        scene: sceneFilter,
      })
      if (cancelled) return
      setTagPickBusy(false)
      if (!r.ok) {
        setTagCandidates([])
        toast.error(r.error)
        return
      }
      setTagCandidates(r.tags)
    }
    const h = window.setTimeout(run, delay)
    return () => {
      cancelled = true
      window.clearTimeout(h)
    }
  }, [tagPickOpen, tagPickQuery, sceneFilter])

  useEffect(() => {
    if (!tagPickOpen) setTagPickQuery('')
  }, [tagPickOpen])

  useEffect(() => {
    if (rolePickValue === ROLE_NONE) {
      setRoleTags([])
      return
    }
    let cancelled = false
    ;(async () => {
      setRoleTagsBusy(true)
      const r = await adminListRoleCategoryTagsPickerAction({
        roleCategoryId: rolePickValue,
      })
      if (cancelled) return
      setRoleTagsBusy(false)
      if (!r.ok) {
        setRoleTags([])
        toast.error(r.error)
        return
      }
      setRoleTags(r.tags)
    })()
    return () => {
      cancelled = true
    }
  }, [rolePickValue])

  async function onPickTool(t: SelectedTool) {
    setSelectedTool(t)
    setToolPickOpen(false)
    setLoadingTagsForTool(true)
    const r = await adminGetToolTagsForEditorAction({ toolId: t.id })
    setLoadingTagsForTool(false)
    if (!r.ok) {
      toast.error(r.error)
      setDraftTags([])
      return
    }
    setDraftTags(
      r.tags.map((x) => ({
        name: x.name,
        tag_category_id: x.tag_category_id,
      })),
    )
  }

  function pushTag(name: string, tag_category_id?: string | null): boolean {
    let hitCap = false
    let dup = false
    setDraftTags((prev) => {
      const n = name.normalize('NFKC').trim().replace(/\s+/g, ' ')
      if (!n) return prev
      const k = n.toLowerCase()
      if (prev.some((x) => x.name.toLowerCase() === k)) {
        dup = true
        return prev
      }
      if (prev.length >= TOOL_TAGS_MAX) {
        hitCap = true
        return prev
      }
      const row: DraftTag =
        tag_category_id !== undefined
          ? { name: n, tag_category_id }
          : { name: n }
      return [...prev, row]
    })
    if (hitCap) toast.error(`最多 ${TOOL_TAGS_MAX} 个标签`)
    return !hitCap && !dup
  }

  function removeDraftAt(index: number) {
    setDraftTags((prev) => prev.filter((_, i) => i !== index))
  }

  function onSave() {
    startSaveTransition(async () => {
      if (!selectedTool) {
        toast.error('请先选择工具')
        return
      }
      const hints: Record<string, string | null> = {}
      const sceneSid = SCENE_FILTER_UUID_RE.test(sceneFilter.trim())
        ? sceneFilter.trim().toLowerCase()
        : null

      for (const d of draftTags) {
        const k = d.name
          .normalize('NFKC')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase()

        let hintVal: string | null | undefined

        if (sceneSid) {
          /** 下拉选了具体场景：保存语义即「当前列表归入该场景」，一律写入该 UUID（避免草稿里残留其它场景的 id 导致详情页「场景分类」为空或与首页不一致） */
          hintVal = sceneSid
        } else if (sceneFilter === 'uncategorized') {
          if ('tag_category_id' in d) {
            hintVal = d.tag_category_id ?? null
          }
          if (hintVal === undefined || hintVal === null) {
            hintVal = null
          }
        } else if ('tag_category_id' in d) {
          hintVal = d.tag_category_id ?? null
        }

        if (hintVal !== undefined) {
          hints[k] = hintVal
        }
      }

      const res = await setToolTagsAction({
        toolId: selectedTool.id,
        tagNames: draftTags.map((d) => d.name),
        tagCategoryHints:
          Object.keys(hints).length > 0 ? hints : undefined,
      })
      if (res.error) toast.error(res.error)
      else toast.success('已保存标签')
    })
  }

  return (
    <div className="space-y-8 rounded-xl border border-border bg-card/30 p-4 md:p-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">1. 选择工具</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Popover open={toolPickOpen} onOpenChange={setToolPickOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-[220px] justify-between gap-2"
              >
                {selectedTool ? (
                  <span className="truncate">{selectedTool.name}</span>
                ) : (
                  <span className="text-muted-foreground">搜索并选择工具…</span>
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(420px,calc(100vw-3rem))] p-0"
              align="start"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="名称或 slug（留空按更新时间列出）…"
                  value={toolQuery}
                  onValueChange={setToolQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {toolBusy ? '加载中…' : '没有匹配的工具'}
                  </CommandEmpty>
                  <CommandGroup heading="工具">
                    {toolCandidates.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.name} ${t.slug}`}
                        onSelect={() => {
                          void onPickTool(t)
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

          {selectedTool ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-mono text-[10px]">
                {selectedTool.status}
              </Badge>
              <span className="font-mono">{selectedTool.slug}</span>
              <Link
                href={`/tool/${selectedTool.slug}`}
                className="font-medium text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                前台预览
              </Link>
            </div>
          ) : null}
          {loadingTagsForTool ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              载入标签…
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">2. 辅助筛选</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="min-w-0 space-y-1.5 sm:max-w-[min(100%,280px)]">
            <span className="text-xs text-muted-foreground">场景（约束标签搜索）</span>
            <Select value={sceneFilter} onValueChange={setSceneFilter}>
              <SelectTrigger size="sm" className="w-full sm:w-[min(100%,280px)]">
                <SelectValue placeholder="场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部场景</SelectItem>
                <SelectItem value="uncategorized">未归类场景</SelectItem>
                {sceneSelectItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.is_disabled ? '（已禁用）' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5 sm:max-w-[min(100%,280px)]">
            <span className="text-xs text-muted-foreground">角色（候选一键并入）</span>
            <Select value={rolePickValue} onValueChange={setRolePickValue}>
              <SelectTrigger size="sm" className="w-full sm:w-[min(100%,280px)]">
                <SelectValue placeholder="角色分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLE_NONE}>不选角色</SelectItem>
                {[...roleCategories]
                  .sort(
                    (a, b) =>
                      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                      a.name.localeCompare(b.name, 'zh-CN'),
                  )
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.is_disabled ? '（已禁用）' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">
          提示：首页「按场景」按<strong>标签</strong>上的场景挂载聚合；详情页「场景分类」同样读此字段。种子库里<strong>没有</strong>名叫「数据与编程」的标签词条（那是场景分类名），请选用该场景下的具体标签。若在左侧选定某一<strong>具体场景</strong>再保存，会<strong>一律</strong>把当前列表里的词条归到该场景（写入每条{' '}
          <code className="rounded bg-muted px-1 py-px text-[11px]">tags.tag_category_id</code>
          ，词条全局一条，其它挂载同一词条的工具也会看到场景变更）。
        </p>

        {rolePickValue !== ROLE_NONE ? (
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>来自角色分类的标签（点击加入草稿）</span>
              {roleTagsBusy ? <Spinner className="h-3.5 w-3.5" /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {roleTags.length === 0 && !roleTagsBusy ? (
                <span className="text-xs text-muted-foreground">
                  该角色下暂无挂载标签，请到「角色分类管理」维护。
                </span>
              ) : null}
              {roleTags.map((tg) => (
                <Button
                  key={tg.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    pushTag(tg.name, tg.tag_category_id ?? undefined)
                  }}
                >
                  <Plus className="h-3 w-3" />
                  {tg.name}
                  {tg.is_disabled ? (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-[9px]">
                      禁用
                    </Badge>
                  ) : null}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              3. 当前标签
            </h2>
            <p className="mt-0.5 space-y-1 text-xs text-muted-foreground">
              <span className="block">
                至多 {TOOL_TAGS_MAX} 个；顺序即前台展示顺序。
              </span>
              <span className="block">
                保存写入 `tool_tags`，并按草稿附带的信息回填 `tags.tag_category_id`；
                首页「按场景」只收录<strong>已挂载场景</strong>的标签。
              </span>
              <span className="block">
                下方预览区与前台详情一致：<strong>场景分类</strong>来自词条的场景挂载；
                <strong>标签</strong>为前台展示顺序（保存前亦可预览）。
              </span>
            </p>
          </div>
          <Popover open={tagPickOpen} onOpenChange={setTagPickOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedTool || loadingTagsForTool}
              >
                搜索添加标签…
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(420px,calc(100vw-3rem))] p-0"
              align="start"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="标签名模糊匹配…"
                  value={tagPickQuery}
                  onValueChange={setTagPickQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {tagPickBusy ? '加载中…' : '没有匹配的标签'}
                  </CommandEmpty>
                  <CommandGroup heading="选用标签">
                    {tagCandidates.map((tg) => (
                      <CommandItem
                        key={tg.id}
                        value={tg.name}
                        onSelect={() => {
                          pushTag(
                            tg.name,
                            sceneAwareTagCategoryHint(tg, sceneFilter),
                          )
                        }}
                      >
                        <span className="truncate">{tg.name}</span>
                        {tg.is_disabled ? (
                          <Badge
                            variant="secondary"
                            className="ml-auto shrink-0 text-[9px]"
                          >
                            禁用
                          </Badge>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-3">
          {!selectedTool ? (
            <p className="rounded-lg border border-dashed border-border/90 bg-background/50 p-4 text-sm text-muted-foreground">
              先选择工具后可预览场景与标签。
            </p>
          ) : draftTags.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/90 bg-background/50 p-4 text-sm text-muted-foreground">
              暂无标签，请搜索或从角色候选加入。
            </p>
          ) : (
            <>
              {draftSceneSummaries.length > 0 || draftOrphanSceneIds.length > 0 ? (
                <section
                  className="rounded-xl border border-border bg-gradient-to-br from-muted/40 via-card to-muted/25 px-4 py-3.5 shadow-sm"
                  aria-label="草稿所属场景"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FolderTree
                      className="h-3.5 w-3.5 shrink-0 text-primary/80"
                      aria-hidden
                    />
                    <span>场景分类</span>
                    <span className="font-normal text-[11px] text-muted-foreground/90">
                      （与前台详情「场景分类」同源）
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {draftSceneSummaries.map((s) => (
                      <Link
                        key={s.id}
                        href={tagCategoryPublicPath(s.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Badge
                          variant="outline"
                          className="border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium hover:bg-primary/10"
                        >
                          {s.name}
                          {s.is_disabled ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ·停
                            </span>
                          ) : null}
                        </Badge>
                      </Link>
                    ))}
                    {draftOrphanSceneIds.map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="px-3 py-1 font-mono text-[10px]"
                        title="未知场景 id，请到「场景分类管理」核对"
                      >
                        场景?
                        {id.slice(0, 8)}…
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : (
                <p className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
                  当前草稿推导不出场景：请选择左侧<strong>具体场景</strong>再保存，或为词条指定场景后再试。
                </p>
              )}

              <section
                className={cn(
                  'rounded-xl border border-border bg-gradient-to-br from-muted/50 via-card to-muted/30 px-4 py-3.5 shadow-sm',
                )}
                aria-label="草稿标签词条"
              >
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                  <span>标签</span>
                  <span className="font-normal text-[11px] text-muted-foreground/90">
                    （自上而下即前台展示顺序；点 × 移除）
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draftTags.map((row, idx) => (
                    <span
                      key={`${row.name}-${idx}`}
                      className="inline-flex items-center gap-0.5 rounded-full border border-primary/15 bg-primary/8 py-1 pr-0.5 pl-3 text-xs font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:bg-primary/15"
                    >
                      <span>{row.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-background/50"
                        aria-label={`移除 ${row.name}`}
                        onClick={() => removeDraftAt(idx)}
                      >
                        <X className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <Button
          type="button"
          onClick={onSave}
          disabled={!selectedTool || loadingTagsForTool || savePending}
        >
          {savePending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              保存中…
            </>
          ) : (
            '保存标签'
          )}
        </Button>
      </section>
    </div>
  )
}
