'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BellRing,
  Bookmark,
  ChevronsUpDown,
  Plus,
} from 'lucide-react'
import type { RoleCategory, TagCategory, Tool, HomeListedTool } from '@/lib/types'
import {
  ACCOUNT_FOLLOW_TOOLS_MAX,
  type UserFollowCategoryJoined,
  type UserFollowToolEntry,
} from '@/lib/account-follows-types'
import {
  fetchFollowRoleToolsAction,
  fetchFollowSceneToolsAction,
  saveAccountFollowsAction,
  searchToolsForFollowPickerAction,
} from '@/app/account/follows/actions'
import { AccountFollowToolMiniTile } from '@/components/account-follow-tool-tile'
import { ToolCard } from '@/components/tool-card'
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
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function toolListingOk(t: Tool): boolean {
  return t.status === 'approved' && !(t.is_disabled === true)
}

function toolRecordFromEntries(entries: UserFollowToolEntry[]): Record<string, Tool> {
  return Object.fromEntries(entries.map((e) => [e.tool_id, e.tool]))
}

function toggleSetMember(set: Set<string>, id: string, on: boolean): Set<string> {
  const n = new Set(set)
  if (on) n.add(id)
  else n.delete(id)
  return n
}

function ToggleChip({
  label,
  active,
  disabled,
  onToggle,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        active
          ? 'border-primary bg-primary/15 text-foreground shadow-sm'
          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70',
      )}
    >
      {label}
    </button>
  )
}

export function AccountFollowsPanel({
  enabledScenes,
  enabledRoles,
  initialSceneFollows,
  initialRoleFollows,
  initialToolFollows,
}: {
  enabledScenes: TagCategory[]
  enabledRoles: RoleCategory[]
  initialSceneFollows: UserFollowCategoryJoined[]
  initialRoleFollows: UserFollowCategoryJoined[]
  initialToolFollows: UserFollowToolEntry[]
}) {
  const router = useRouter()
  const [sceneIds, setSceneIds] = useState<Set<string>>(() =>
    new Set(initialSceneFollows.map((x) => x.id)),
  )
  const [roleIds, setRoleIds] = useState<Set<string>>(() =>
    new Set(initialRoleFollows.map((x) => x.id)),
  )

  const [toolOrderIds, setToolOrderIds] = useState<string[]>(() =>
    initialToolFollows.map((e) => e.tool_id),
  )
  const [toolMap, setToolMap] = useState<Record<string, Tool>>(() =>
    toolRecordFromEntries(initialToolFollows),
  )

  const [toolPickOpen, setToolPickOpen] = useState(false)
  const [toolPickQuery, setToolPickQuery] = useState('')
  const [toolPickBusy, setToolPickBusy] = useState(false)
  const [toolCandidates, setToolCandidates] = useState<Tool[]>([])

  useEffect(() => {
    setSceneIds(new Set(initialSceneFollows.map((x) => x.id)))
    setRoleIds(new Set(initialRoleFollows.map((x) => x.id)))
  }, [initialSceneFollows, initialRoleFollows])

  useEffect(() => {
    setToolOrderIds(initialToolFollows.map((e) => e.tool_id))
    setToolMap(toolRecordFromEntries(initialToolFollows))
  }, [initialToolFollows])

  useEffect(() => {
    if (!toolPickOpen) return
    let cancelled = false
    const delay = toolPickQuery.trim().length > 0 ? 240 : 0
    const h = window.setTimeout(async () => {
      setToolPickBusy(true)
      const r = await searchToolsForFollowPickerAction({
        query: toolPickQuery,
      })
      if (cancelled) return
      setToolPickBusy(false)
      if (r.error) {
        setToolCandidates([])
        toast.error(r.error)
        return
      }
      setToolCandidates(r.tools ?? [])
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(h)
    }
  }, [toolPickOpen, toolPickQuery])

  useEffect(() => {
    if (!toolPickOpen) setToolPickQuery('')
  }, [toolPickOpen])

  const activeFollowToolsOrdered = useMemo(() => {
    const out: Tool[] = []
    const seen = new Set<string>()
    for (const id of toolOrderIds) {
      const t = toolMap[id]
      if (!t || !toolListingOk(t)) continue
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push(t)
    }
    return out
  }, [toolOrderIds, toolMap])

  const staleFollowTools = useMemo(() => {
    const out: Tool[] = []
    const seen = new Set<string>()
    for (const id of toolOrderIds) {
      const t = toolMap[id]
      if (!t || toolListingOk(t)) continue
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push(t)
    }
    return out
  }, [toolOrderIds, toolMap])

  function removeFollowTool(toolId: string) {
    setToolOrderIds((prev) => prev.filter((x) => x !== toolId))
    setToolMap((prev) => {
      const { [toolId]: _drop, ...rest } = prev
      return rest
    })
  }

  function addFollowTool(t: Tool) {
    if (toolOrderIds.length >= ACCOUNT_FOLLOW_TOOLS_MAX) {
      toast.error(`最多关注 ${ACCOUNT_FOLLOW_TOOLS_MAX} 个工具`)
      return false
    }
    const id = t.id
    if (toolOrderIds.some((x) => x === id)) {
      toast.message('已在关注列表中')
      return false
    }
    if (!toolListingOk(t)) {
      toast.error('仅可添加已通过且未隐藏的工具')
      return false
    }
    setToolOrderIds((prev) => [...prev, id])
    setToolMap((prev) => ({ ...prev, [id]: t }))
    return true
  }

  const staleScenes = useMemo(
    () =>
      initialSceneFollows.filter(
        (row) => row.is_disabled && sceneIds.has(row.id),
      ),
    [initialSceneFollows, sceneIds],
  )

  const staleRoles = useMemo(
    () =>
      initialRoleFollows.filter(
        (row) => row.is_disabled && roleIds.has(row.id),
      ),
    [initialRoleFollows, roleIds],
  )

  const activeScenes = useMemo(
    () => enabledScenes.filter((c) => sceneIds.has(c.id)),
    [enabledScenes, sceneIds],
  )

  const activeRoles = useMemo(
    () => enabledRoles.filter((r) => roleIds.has(r.id)),
    [enabledRoles, roleIds],
  )

  const [pickedSceneId, setPickedSceneId] = useState<string | null>(null)
  const [pickedRoleId, setPickedRoleId] = useState<string | null>(null)

  useEffect(() => {
    if (pickedSceneId && activeScenes.some((s) => s.id === pickedSceneId)) return
    setPickedSceneId(activeScenes[0]?.id ?? null)
  }, [activeScenes, pickedSceneId])

  useEffect(() => {
    if (pickedRoleId && activeRoles.some((r) => r.id === pickedRoleId)) return
    setPickedRoleId(activeRoles[0]?.id ?? null)
  }, [activeRoles, pickedRoleId])

  const [sceneTools, setSceneTools] = useState<Tool[]>([])
  const [roleTools, setRoleTools] = useState<Tool[]>([])
  const [sceneToolsErr, setSceneToolsErr] = useState<string | null>(null)
  const [roleToolsErr, setRoleToolsErr] = useState<string | null>(null)

  const [fetchScenePending, startFetchScene] = useTransition()
  const [fetchRolePending, startFetchRole] = useTransition()

  useEffect(() => {
    if (!pickedSceneId) {
      setSceneTools([])
      setSceneToolsErr(null)
      return
    }
    let cancelled = false
    startFetchScene(async () => {
      const r = await fetchFollowSceneToolsAction(pickedSceneId)
      if (cancelled) return
      if (r.error) {
        setSceneToolsErr(r.error)
        setSceneTools([])
        return
      }
      setSceneToolsErr(null)
      setSceneTools(r.tools ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [pickedSceneId])

  useEffect(() => {
    if (!pickedRoleId) {
      setRoleTools([])
      setRoleToolsErr(null)
      return
    }
    let cancelled = false
    startFetchRole(async () => {
      const r = await fetchFollowRoleToolsAction(pickedRoleId)
      if (cancelled) return
      if (r.error) {
        setRoleToolsErr(r.error)
        setRoleTools([])
        return
      }
      setRoleToolsErr(null)
      setRoleTools(r.tools ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [pickedRoleId])

  const [savePending, startSave] = useTransition()

  const onSave = useCallback(() => {
    startSave(async () => {
      const res = await saveAccountFollowsAction({
        tagCategoryIds: [...sceneIds],
        roleCategoryIds: [...roleIds],
        toolIds: [...toolOrderIds],
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('已保存关注')
      router.refresh()
    })
  }, [router, sceneIds, roleIds, toolOrderIds])

  const listTabDefault =
    activeScenes.length > 0 ? 'scene' : activeRoles.length > 0 ? 'role' : 'scene'

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12">
          <BellRing className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold text-foreground">我的关注</h1>
          <p className="text-sm text-muted-foreground">
            订阅场景 / 角色分类；亦可 pinned 至多 {ACCOUNT_FOLLOW_TOOLS_MAX}{' '}
            个工具（与收藏独立）。停用或隐藏的分类会单独列出；下架的工具也会在下方提示。
            页面下部列表均为只读浏览。
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">订阅偏好</h2>
          <Button
            type="button"
            size="sm"
            disabled={savePending}
            onClick={onSave}
          >
            {savePending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                保存中…
              </>
            ) : (
              '保存关注（场景 · 角色 · 工具）'
            )}
          </Button>
        </div>

        {(staleScenes.length > 0 || staleRoles.length > 0) && (
          <div
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm text-foreground"
            role="region"
            aria-label="已失效的关注"
          >
            <div className="mb-2 flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              已失效的关注（平台已停用或隐藏对应分类）
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              下列条目仍占用你的订阅位；取消勾选即可移除。物理删除的分类会从数据库一并清除订阅，此处不再展示。
            </p>
            <div className="flex flex-wrap gap-3">
              {staleScenes.length > 0 ? (
                <div className="min-w-[140px] flex-1 space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    场景分类
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {staleScenes.map((row) => (
                      <ToggleChip
                        key={row.id}
                        label={`${row.name}（已停用）`}
                        active={sceneIds.has(row.id)}
                        onToggle={() =>
                          setSceneIds((prev) =>
                            toggleSetMember(prev, row.id, !prev.has(row.id)),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {staleRoles.length > 0 ? (
                <div className="min-w-[140px] flex-1 space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    角色分类
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {staleRoles.map((row) => (
                      <ToggleChip
                        key={row.id}
                        label={`${row.name}（已停用）`}
                        active={roleIds.has(row.id)}
                        onToggle={() =>
                          setRoleIds((prev) =>
                            toggleSetMember(prev, row.id, !prev.has(row.id)),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">场景分类</h3>
          <div className="flex flex-wrap gap-2">
            {enabledScenes.map((c) => (
              <ToggleChip
                key={c.id}
                label={c.name}
                active={sceneIds.has(c.id)}
                onToggle={() =>
                  setSceneIds((prev) =>
                    toggleSetMember(prev, c.id, !prev.has(c.id)),
                  )
                }
              />
            ))}
          </div>
          {enabledScenes.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无可订阅的场景分类。</p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border/70 pt-4">
          <h3 className="text-sm font-medium text-foreground">角色分类</h3>
          <div className="flex flex-wrap gap-2">
            {enabledRoles.map((r) => (
              <ToggleChip
                key={r.id}
                label={r.name}
                active={roleIds.has(r.id)}
                onToggle={() =>
                  setRoleIds((prev) =>
                    toggleSetMember(prev, r.id, !prev.has(r.id)),
                  )
                }
              />
            ))}
          </div>
          {enabledRoles.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无可订阅的角色分类。</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-foreground">关注的工具</h2>
            <p className="text-xs text-muted-foreground">
              至多 {ACCOUNT_FOLLOW_TOOLS_MAX} 个；宽屏下一行 10 格、最多两行排列。
              鼠标悬停显示概述（与首页工具卡片 tooltip 一致）。与「我的收藏」互不抢占名额，
              需点击上方「保存关注」写入数据库。
            </p>
          </div>
          <Popover open={toolPickOpen} onOpenChange={setToolPickOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={toolOrderIds.length >= ACCOUNT_FOLLOW_TOOLS_MAX}
              >
                <Plus className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                搜索添加工具
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(420px,calc(100vw-3rem))] p-0"
              align="end"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="名称或 slug（留空列出近期上架）…"
                  value={toolPickQuery}
                  onValueChange={setToolPickQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {toolPickBusy ? '加载中…' : '没有匹配的工具'}
                  </CommandEmpty>
                  <CommandGroup heading="选用工具">
                    {toolCandidates.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.name} ${t.slug}`}
                        disabled={
                          toolOrderIds.length >= ACCOUNT_FOLLOW_TOOLS_MAX ||
                          toolOrderIds.includes(t.id)
                        }
                        onSelect={() => {
                          if (addFollowTool(t)) {
                            setToolPickOpen(false)
                          }
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

        {staleFollowTools.length > 0 ? (
          <div
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm"
            role="region"
            aria-label="已失效的单个工具关注"
          >
            <div className="mb-2 flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              已失效的工具关注（未通过审核或已被平台隐藏）
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              下列条目仍占用一个关注位；可点击 ✕ 从列表移除，保存后即生效。
            </p>
            <div className="flex flex-wrap gap-2">
              {staleFollowTools.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-800/25 bg-background/60 px-2 py-1 text-xs"
                >
                  <span className="truncate max-w-[140px]">{t.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label={`移除 ${t.name}`}
                    onClick={() => removeFollowTool(t.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
          {activeFollowToolsOrdered.map((t) => (
            <AccountFollowToolMiniTile
              key={t.id}
              tool={t}
              onRemove={() => removeFollowTool(t.id)}
            />
          ))}
        </div>

        {activeFollowToolsOrdered.length === 0 && staleFollowTools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            尚未 pinned 工具。点击右上角搜索添加（至多{' '}
            {ACCOUNT_FOLLOW_TOOLS_MAX} 个）。
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card/40 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            关注动态 · 工具列表
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          按场景或角色查看当前订阅下的公开工具（已上架且未隐藏）；不可在此编辑标签或分类。
        </p>

        <Tabs defaultValue={listTabDefault} className="w-full gap-3">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="scene" className="text-xs sm:text-sm">
              场景订阅
              {activeScenes.length > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({activeScenes.length})
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="role" className="text-xs sm:text-sm">
              角色订阅
              {activeRoles.length > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({activeRoles.length})
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scene" className="mt-0 space-y-3 focus-visible:outline-none">
            {activeScenes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                尚未订阅任何<strong className="text-foreground">启用中</strong>
                的场景分类；或在上方保存后刷新。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {activeScenes.map((c) => (
                    <ToggleChip
                      key={c.id}
                      label={c.name}
                      active={pickedSceneId === c.id}
                      onToggle={() => setPickedSceneId(c.id)}
                    />
                  ))}
                </div>
                {sceneToolsErr ? (
                  <p className="text-sm text-destructive">{sceneToolsErr}</p>
                ) : null}
                {fetchScenePending && pickedSceneId ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="h-3.5 w-3.5" />
                    加载工具…
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                  {sceneTools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool as HomeListedTool}
                      fluid
                    />
                  ))}
                </div>
                {!fetchScenePending && pickedSceneId && sceneTools.length === 0 && !sceneToolsErr ? (
                  <p className="text-sm text-muted-foreground">
                    该分类下暂无符合条件的工具。
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="role" className="mt-0 space-y-3 focus-visible:outline-none">
            {activeRoles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                尚未订阅任何<strong className="text-foreground">启用中</strong>
                的角色分类；或在上方保存后刷新。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {activeRoles.map((r) => (
                    <ToggleChip
                      key={r.id}
                      label={r.name}
                      active={pickedRoleId === r.id}
                      onToggle={() => setPickedRoleId(r.id)}
                    />
                  ))}
                </div>
                {roleToolsErr ? (
                  <p className="text-sm text-destructive">{roleToolsErr}</p>
                ) : null}
                {fetchRolePending && pickedRoleId ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="h-3.5 w-3.5" />
                    加载工具…
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                  {roleTools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool as HomeListedTool}
                      fluid
                    />
                  ))}
                </div>
                {!fetchRolePending && pickedRoleId && roleTools.length === 0 && !roleToolsErr ? (
                  <p className="text-sm text-muted-foreground">
                    该分类下暂无符合条件的工具。
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3 text-sm">
          <span className="text-muted-foreground">小心形收藏的单工具列表：</span>{' '}
          <Link
            href="/favorites"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            前往「我的收藏」
          </Link>
        </div>
      </section>
    </div>
  )
}
