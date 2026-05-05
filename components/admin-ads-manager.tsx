'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  adminUpsertAdAction,
  adminDeleteAdAction,
  adminSetAdStatusAction,
  adminUpdateAdSortOrderAction,
  adminSaveAdSettingsAction,
  type AdFormInput,
} from '@/app/admin/ads/actions'
import {
  searchToolsForAdminAction,
  listAvailableToolsForAdAction,
} from '@/app/admin/ads/search-actions'
import type { AdPlacement, AdSettings, Tool } from '@/lib/types'
import { fileToImageDataUrl } from '@/lib/image-data-url'
import { cn } from '@/lib/utils'

interface AdminAdsManagerProps {
  initialAds: AdPlacement[]
  initialSettings: AdSettings
}

type Bucket = 'section1A' | 'section1B' | 'section1C' | 'section2'

const BUCKET_TITLE: Record<Bucket, string> = {
  section1A: 'Section 1 · Tab A',
  section1B: 'Section 1 · Tab B',
  section1C: 'Section 1 · Tab C',
  section2: 'Section 2 · Banner 轮播',
}

const BUCKET_LIMIT: Record<Bucket, number> = {
  section1A: 20,
  section1B: 20,
  section1C: 20,
  section2: 9,
}

function bucketOf(ad: AdPlacement): Bucket {
  if (ad.placement === 'section2') return 'section2'
  if (ad.tab_key === 'B') return 'section1B'
  if (ad.tab_key === 'C') return 'section1C'
  return 'section1A'
}

function fmtDate(s: string): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

function isLive(ad: AdPlacement): boolean {
  if (ad.status !== 'approved') return false
  const now = Date.now()
  return new Date(ad.starts_at).getTime() <= now && now <= new Date(ad.ends_at).getTime()
}

function AdToolLogo({
  toolName,
  logoUrl,
}: {
  toolName?: string
  logoUrl?: string | null
}) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 1 && img.naturalHeight > 1) {
      setLoaded(true)
    } else {
      setErrored(true)
    }
  }, [])

  const src =
    typeof logoUrl === 'string' && logoUrl.trim().length > 0
      ? logoUrl.trim()
      : null

  return (
    <div
      className={cn(
        'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border',
        (!loaded || errored || !src)
          ? 'border-violet-200 bg-gradient-to-br from-violet-300 via-violet-400 to-purple-500'
          : 'bg-muted',
      )}
    >
      {!errored && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={toolName ?? ''}
          className={cn(
            'h-full w-full object-contain transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={handleLoad}
          onError={() => setErrored(true)}
        />
      )}
      {(!loaded || errored || !src) && (
        <Sparkles className="absolute h-4 w-4 text-white drop-shadow-sm" />
      )}
    </div>
  )
}

export function AdminAdsManager({
  initialAds,
  initialSettings,
}: AdminAdsManagerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [ads, setAds] = useState<AdPlacement[]>(initialAds)
  const [settings, setSettings] = useState<AdSettings>(initialSettings)
  const [editing, setEditing] = useState<AdPlacement | null>(null)
  const [creating, setCreating] = useState<Bucket | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdPlacement | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const m: Record<Bucket, AdPlacement[]> = {
      section1A: [],
      section1B: [],
      section1C: [],
      section2: [],
    }
    for (const a of ads) m[bucketOf(a)].push(a)
    for (const k of Object.keys(m) as Bucket[]) {
      m[k].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return m
  }, [ads])

  const refreshAfterAction = () => {
    startTransition(() => router.refresh())
  }

  const move = async (ad: AdPlacement, dir: 'up' | 'down') => {
    const bucket = bucketOf(ad)
    const list = grouped[bucket]
    const idx = list.findIndex((x) => x.id === ad.id)
    if (idx < 0) return
    const swapWith = list[dir === 'up' ? idx - 1 : idx + 1]
    if (!swapWith) return
    const aOrder = ad.sort_order
    const bOrder = swapWith.sort_order
    setPendingId(ad.id)
    try {
      await Promise.all([
        adminUpdateAdSortOrderAction(ad.id, bOrder),
        adminUpdateAdSortOrderAction(swapWith.id, aOrder),
      ])
      setAds((prev) =>
        prev.map((x) =>
          x.id === ad.id
            ? { ...x, sort_order: bOrder }
            : x.id === swapWith.id
              ? { ...x, sort_order: aOrder }
              : x,
        ),
      )
      refreshAfterAction()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '排序失败')
    } finally {
      setPendingId(null)
    }
  }

  const setStatus = async (
    ad: AdPlacement,
    status: AdPlacement['status'],
    reason?: string,
  ) => {
    setPendingId(ad.id)
    try {
      await adminSetAdStatusAction(ad.id, status, reason ?? null)
      setAds((prev) =>
        prev.map((x) =>
          x.id === ad.id ? { ...x, status, rejection_reason: reason ?? null } : x,
        ),
      )
      toast.success(
        status === 'approved'
          ? '已通过'
          : status === 'rejected'
            ? '已拒绝'
            : '已置为待审',
      )
      refreshAfterAction()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setPendingId(null)
    }
  }

  const remove = async (ad: AdPlacement) => {
    setPendingId(ad.id)
    try {
      await adminDeleteAdAction(ad.id)
      setAds((prev) => prev.filter((x) => x.id !== ad.id))
      toast.success('已删除投放')
      refreshAfterAction()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setPendingId(null)
      setDeleteTarget(null)
    }
  }

  const closeForm = () => {
    setEditing(null)
    setCreating(null)
  }

  const onSubmit = async (input: AdFormInput) => {
    try {
      const r = await adminUpsertAdAction(input)
      toast.success(input.id ? '已更新' : '已新建投放')
      closeForm()
      refreshAfterAction()
      // Optimistic refresh by replacing/inserting
      const merged: AdPlacement = {
        id: r.id,
        tool_id: input.tool_id,
        placement: input.placement,
        tab_key: input.placement === 'section1' ? input.tab_key ?? null : null,
        banner_url: input.banner_url ?? null,
        price: input.price,
        starts_at: new Date(input.starts_at).toISOString(),
        ends_at: new Date(input.ends_at).toISOString(),
        status: input.status,
        rejection_reason: input.rejection_reason ?? null,
        sort_order: input.sort_order ?? 0,
        submitted_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setAds((prev) =>
        prev.some((x) => x.id === merged.id)
          ? prev.map((x) => (x.id === merged.id ? { ...x, ...merged } : x))
          : [merged, ...prev],
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        settings={settings}
        onSave={async (patch) => {
          try {
            const next = await adminSaveAdSettingsAction(patch)
            setSettings(next)
            toast.success('已保存')
            refreshAfterAction()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : '保存失败')
          }
        }}
      />

      <Tabs defaultValue="section1A">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="section1A">
            {BUCKET_TITLE.section1A}
            <Badge variant="secondary" className="ml-2">
              {grouped.section1A.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="section1B">
            {BUCKET_TITLE.section1B}
            <Badge variant="secondary" className="ml-2">
              {grouped.section1B.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="section1C">
            {BUCKET_TITLE.section1C}
            <Badge variant="secondary" className="ml-2">
              {grouped.section1C.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="section2">
            {BUCKET_TITLE.section2}
            <Badge variant="secondary" className="ml-2">
              {grouped.section2.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        {(['section1A', 'section1B', 'section1C', 'section2'] as Bucket[]).map((b) => (
          <TabsContent key={b} value={b} className="mt-3">
            <BucketPanel
              bucket={b}
              ads={grouped[b]}
              pendingId={pendingId}
              onAdd={() => setCreating(b)}
              onEdit={setEditing}
              onMove={move}
              onSetStatus={setStatus}
              onDelete={(ad) => setDeleteTarget(ad)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={creating != null || editing != null}
        onOpenChange={(o) => {
          if (!o) closeForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? '编辑广告投放' : '新建广告投放'}
            </DialogTitle>
            <DialogDescription>
              选择关联工具、所属版块、有效期、价格；Section 2 必须上传 1200×300 banner。
            </DialogDescription>
          </DialogHeader>
          <AdForm
            settings={settings}
            initial={
              editing ?? {
                bucket: creating ?? 'section1A',
              }
            }
            onCancel={closeForm}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除该投放？</AlertDialogTitle>
            <AlertDialogDescription>
              工具仍保留在库中；此投放及其 banner 将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) void remove(deleteTarget)
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SettingsCard({
  settings,
  onSave,
}: {
  settings: AdSettings
  onSave: (patch: Partial<AdSettings>) => Promise<void>
}) {
  const [s, setS] = useState(settings)
  const [saving, setSaving] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>全局设置</CardTitle>
        <CardDescription>
          总开关、Section 1 两个 Tab 名称、Section 2 轮播间隔（秒）、用户提交时显示的参考价格。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">启用 Section 1</Label>
              <Switch
                checked={s.enabled_section1}
                onCheckedChange={(v) => setS({ ...s, enabled_section1: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tab-a">Tab A 名称</Label>
              <Input
                id="tab-a"
                value={s.section1_tab_a_label}
                maxLength={20}
                onChange={(e) =>
                  setS({ ...s, section1_tab_a_label: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tab-b">Tab B 名称</Label>
              <Input
                id="tab-b"
                value={s.section1_tab_b_label}
                maxLength={20}
                onChange={(e) =>
                  setS({ ...s, section1_tab_b_label: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tab-c">Tab C 名称</Label>
              <Input
                id="tab-c"
                value={s.section1_tab_c_label}
                maxLength={20}
                onChange={(e) =>
                  setS({ ...s, section1_tab_c_label: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price1">Section 1 默认价格（¥）</Label>
              <Input
                id="price1"
                type="number"
                min={0}
                step={1}
                value={s.default_price_section1}
                onChange={(e) =>
                  setS({
                    ...s,
                    default_price_section1: Number(e.target.value || 0),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">启用 Section 2</Label>
              <Switch
                checked={s.enabled_section2}
                onCheckedChange={(v) => setS({ ...s, enabled_section2: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rotate">轮播间隔（秒，3–120）</Label>
              <Input
                id="rotate"
                type="number"
                min={3}
                max={120}
                value={s.section2_rotate_seconds}
                onChange={(e) =>
                  setS({
                    ...s,
                    section2_rotate_seconds: Number(e.target.value || 10),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price2">Section 2 默认价格（¥）</Label>
              <Input
                id="price2"
                type="number"
                min={0}
                step={1}
                value={s.default_price_section2}
                onChange={(e) =>
                  setS({
                    ...s,
                    default_price_section2: Number(e.target.value || 0),
                  })
                }
              />
            </div>
            <div className="rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
              修改后会清广告缓存；首页通过 ISR + 标签失效，约 1–2 秒内可见。
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(s)
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
          >
            {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
            保存设置
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BucketPanel({
  bucket,
  ads,
  pendingId,
  onAdd,
  onEdit,
  onMove,
  onSetStatus,
  onDelete,
}: {
  bucket: Bucket
  ads: AdPlacement[]
  pendingId: string | null
  onAdd: () => void
  onEdit: (ad: AdPlacement) => void
  onMove: (ad: AdPlacement, dir: 'up' | 'down') => Promise<void>
  onSetStatus: (
    ad: AdPlacement,
    status: AdPlacement['status'],
    reason?: string,
  ) => Promise<void>
  onDelete: (ad: AdPlacement) => void
}) {
  const limit = BUCKET_LIMIT[bucket]
  const liveCount = ads.filter(isLive).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{BUCKET_TITLE[bucket]}</CardTitle>
        <CardDescription>
          上限 {limit} 条；当前生效 {liveCount} / 已审核 {ads.filter((a) => a.status === 'approved').length} / 共 {ads.length}。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            新建投放
          </Button>
        </div>
        {ads.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            暂无投放
          </p>
        ) : (
          <ul className="space-y-2">
            {ads.map((ad, idx) => {
              const live = isLive(ad)
              const expired = new Date(ad.ends_at).getTime() < Date.now()
              const tool = ad.tool
              return (
                <li
                  key={ad.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3',
                    live ? 'border-emerald-300 bg-emerald-50/40' : 'bg-card',
                  )}
                >
                  <div className="flex flex-1 items-center gap-3">
                    <AdToolLogo
                      toolName={tool?.name}
                      logoUrl={tool?.logo_url}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {tool?.name ?? ad.tool_id.slice(0, 8)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fmtDate(ad.starts_at)} → {fmtDate(ad.ends_at)} · ¥
                        {ad.price}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          ad.status === 'approved'
                            ? 'default'
                            : ad.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {ad.status === 'approved'
                          ? '已通过'
                          : ad.status === 'rejected'
                            ? '已拒绝'
                            : '待审'}
                      </Badge>
                      {live ? (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
                          生效中
                        </Badge>
                      ) : expired ? (
                        <Badge variant="outline">已过期</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pendingId === ad.id || idx === 0}
                      onClick={() => void onMove(ad, 'up')}
                      title="上移"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pendingId === ad.id || idx === ads.length - 1}
                      onClick={() => void onMove(ad, 'down')}
                      title="下移"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {ad.status !== 'approved' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600"
                        disabled={pendingId === ad.id}
                        onClick={() => void onSetStatus(ad, 'approved')}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        通过
                      </Button>
                    ) : null}
                    {ad.status !== 'rejected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={pendingId === ad.id}
                        onClick={() => {
                          const reason =
                            window.prompt('拒绝原因（可留空）') ?? '已下线'
                          void onSetStatus(ad, 'rejected', reason)
                        }}
                      >
                        <X className="mr-1 h-3 w-3" />
                        下线
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(ad)}
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onDelete(ad)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

type AdFormProps = {
  settings: AdSettings
  initial:
    | AdPlacement
    | { bucket: Bucket }
  onCancel: () => void
  onSubmit: (input: AdFormInput) => Promise<void>
}

function bucketToPlacementTab(b: Bucket): {
  placement: 'section1' | 'section2'
  tab_key: 'A' | 'B' | 'C' | null
} {
  if (b === 'section2') return { placement: 'section2', tab_key: null }
  if (b === 'section1B') return { placement: 'section1', tab_key: 'B' }
  if (b === 'section1C') return { placement: 'section1', tab_key: 'C' }
  return { placement: 'section1', tab_key: 'A' }
}

function toLocalISO(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  const tzMs = date.getTime() - date.getTimezoneOffset() * 60_000
  return new Date(tzMs).toISOString().slice(0, 16)
}

function AdForm({ settings, initial, onCancel, onSubmit }: AdFormProps) {
  const isCreate = !('id' in initial)
  const initialBucket: Bucket = isCreate
    ? (initial as { bucket: Bucket }).bucket
    : bucketOf(initial as AdPlacement)
  const initialPT = bucketToPlacementTab(initialBucket)

  const ad = isCreate ? null : (initial as AdPlacement)

  const [tool, setTool] = useState<{
    id: string
    name: string
    slug: string
  } | null>(
    ad?.tool
      ? { id: ad.tool.id, name: ad.tool.name, slug: ad.tool.slug }
      : null,
  )
  const [placement, setPlacement] = useState<'section1' | 'section2'>(
    initialPT.placement,
  )
  const [tabKey, setTabKey] = useState<'A' | 'B' | 'C' | null>(initialPT.tab_key)
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    ad?.banner_url ?? null,
  )
  const [price, setPrice] = useState<number>(
    ad?.price ??
      (initialBucket === 'section2'
        ? settings.default_price_section2
        : settings.default_price_section1),
  )
  const [startsAt, setStartsAt] = useState<string>(
    ad ? toLocalISO(ad.starts_at) : toLocalISO(new Date()),
  )
  const [endsAt, setEndsAt] = useState<string>(
    ad
      ? toLocalISO(ad.ends_at)
      : toLocalISO(new Date(Date.now() + 30 * 86_400_000)),
  )
  const [status, setStatus] = useState<AdPlacement['status']>(
    ad?.status ?? 'approved',
  )
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!tool) {
      toast.error('请先搜索并选择关联工具')
      return
    }
    if (placement === 'section2' && !bannerUrl) {
      toast.error('Section 2 必须上传 banner')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        id: ad?.id,
        tool_id: tool.id,
        placement,
        tab_key: placement === 'section1' ? tabKey : null,
        banner_url: bannerUrl,
        price,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        status,
        sort_order: ad?.sort_order,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ToolPicker initial={tool} onChange={setTool} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>版块</Label>
          <Select
            value={placement}
            onValueChange={(v) => {
              const p = v as 'section1' | 'section2'
              setPlacement(p)
              if (p === 'section2') setTabKey(null)
              else if (!tabKey) setTabKey('A')
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="section1">Section 1（左 Tab + 网格）</SelectItem>
              <SelectItem value="section2">Section 2（Banner 轮播）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {placement === 'section1' ? (
          <div className="space-y-1.5">
            <Label>Tab</Label>
            <Select
              value={tabKey ?? 'A'}
              onValueChange={(v) => setTabKey(v as 'A' | 'B')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">
                  A · {settings.section1_tab_a_label}
                </SelectItem>
                <SelectItem value="B">
                  B · {settings.section1_tab_b_label}
                </SelectItem>
                <SelectItem value="C">
                  C · {settings.section1_tab_c_label}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <BannerUploader
        value={bannerUrl}
        onChange={setBannerUrl}
        required={placement === 'section2'}
        label={placement === 'section2' ? 'Banner 图（必填，1200×300）' : '自定义图片（可选，正方形）'}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>开始时间</Label>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>结束时间</Label>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>价格（¥）</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value || 0))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>状态</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as AdPlacement['status'])}
        >
          <SelectTrigger className="sm:max-w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">待审</SelectItem>
            <SelectItem value="approved">通过</SelectItem>
            <SelectItem value="rejected">拒绝</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
          {ad ? '保存' : '创建'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function ToolPicker({
  initial,
  onChange,
}: {
  initial: { id: string; name: string; slug: string } | null
  onChange: (
    t: { id: string; name: string; slug: string } | null,
  ) => void
}) {
  const [picked, setPicked] = useState(initial)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Tool[]>([])
  const [loading, setLoading] = useState(false)
  const [allTools, setAllTools] = useState<{ id: string; name: string; slug: string }[]>([])
  const [loadingAll, setLoadingAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingAll(true)
    listAvailableToolsForAdAction()
      .then((list) => {
        if (!cancelled) setAllTools(list)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAll(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const search = async () => {
    if (!keyword.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const r = await searchToolsForAdminAction(keyword.trim())
      setResults(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (t: { id: string; name: string; slug: string }) => {
    setPicked(t)
    onChange(t)
  }

  const filteredTools = useMemo(() => {
    if (!keyword.trim()) return allTools
    const kw = keyword.toLowerCase()
    return allTools.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) || t.slug.toLowerCase().includes(kw),
    )
  }, [allTools, keyword])

  return (
    <div className="space-y-2">
      <Label>关联工具</Label>
      {picked ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{picked.name}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              /{picked.slug}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked(null)
              onChange(null)
            }}
          >
            更换
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="搜索工具名 / slug…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void search()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => void search()}>
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground">搜索中…</p>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">搜索结果</p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded-md border bg-card p-1">
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => handleSelect({ id: t.id, name: t.name, slug: t.slug })}
                    >
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        /{t.slug}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              快速选择（按访问量排序，共 {filteredTools.length} 个）
            </p>
            {loadingAll ? (
              <p className="py-2 text-center text-xs text-muted-foreground">加载中…</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-auto rounded-md border bg-card p-1">
                {filteredTools.length === 0 ? (
                  <li className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                    无匹配工具
                  </li>
                ) : (
                  filteredTools.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => handleSelect(t)}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          /{t.slug}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BannerUploader({
  value,
  onChange,
  required = false,
  label = 'Banner 图',
}: {
  value: string | null
  onChange: (v: string | null) => void
  required?: boolean
  label?: string
}) {
  const [pasting, setPasting] = useState(false)

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 3_000_000) {
      toast.error('请压缩至 3MB 以内')
      return
    }
    setPasting(true)
    try {
      const url = await fileToImageDataUrl(file)
      onChange(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '处理失败')
    } finally {
      setPasting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="overflow-hidden rounded-md border bg-muted/30">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                value.startsWith('http') || value.startsWith('data:')
                  ? value
                  : value
              }
              alt="banner preview"
              className="h-auto w-full max-w-full object-cover"
              style={{ aspectRatio: '4 / 1' }}
            />
          ) : (
            <div
              className="flex w-full items-center justify-center text-sm text-muted-foreground"
              style={{ aspectRatio: '4 / 1' }}
            >
              无 banner，请上传
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            id="banner-file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('banner-file')?.click()}
            disabled={pasting}
          >
            选择图片
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              移除
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea
        placeholder="或粘贴 banner 图 URL（http(s)）"
        value={
          value && value.startsWith('http') ? value : ''
        }
        rows={2}
        onChange={(e) => onChange(e.target.value.trim() || null)}
      />
    </div>
  )
}
