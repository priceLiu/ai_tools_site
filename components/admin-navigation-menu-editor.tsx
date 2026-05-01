'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { NavigationMenuItemRow } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  syncCategoriesFromNavigationAction,
  addNavigationMenuItemAction,
  updateNavigationMenuItemAction,
  deleteNavigationMenuItemAction,
} from '@/app/admin/navigation/actions'
import {
  validateNavIconName,
  validateNavigationMenuItem,
  validateNavSortOrder,
} from '@/lib/nav-menu-validation'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AdminNavigationMenuEditorProps {
  initialRows: NavigationMenuItemRow[]
}

export function AdminNavigationMenuEditor({
  initialRows,
}: AdminNavigationMenuEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [href, setHref] = useState('/')
  const [iconName, setIconName] = useState('Sparkles')
  const [sortOrder, setSortOrder] = useState(100)
  const [parentId, setParentId] = useState<string | null>(null)
  const [visibleNew, setVisibleNew] = useState(true)

  const [syncHint, setSyncHint] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const sorted = useMemo(
    () => [...initialRows].sort((a, b) => a.sort_order - b.sort_order),
    [initialRows],
  )

  const childrenOfParent = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of sorted) {
      const pk = r.parent_id ?? '__root__'
      if (!m.has(pk)) m.set(pk, [])
      m.get(pk)!.push(r.id)
    }
    return m
  }, [sorted])

  const descendantIds = (rootId: string) => {
    const out = new Set<string>()
    const walk = (pid: string) => {
      const ch = childrenOfParent.get(pid)
      ch?.forEach((id) => {
        out.add(id)
        walk(id)
      })
    }
    walk(rootId)
    return out
  }

  const invalidate = () => startTransition(() => router.refresh())

  const toastIfCategoriesCreated = (sync?: {
    created: number
    slugs: string[]
  }) => {
    if (sync && sync.created > 0) {
      toast({
        variant: 'success',
        title: '添加分类成功',
        description:
          sync.created === 1
            ? `slug：${sync.slugs[0]}`
            : `已新增 ${sync.created} 条：${sync.slugs.join('、')}`,
      })
    }
  }

  const toastError = (title: string, description: string) => {
    toast({ variant: 'destructive', title, description })
  }

  const applyMutationSyncHint = (
    r: Awaited<ReturnType<typeof addNavigationMenuItemAction>>,
    dbFailVerb: '保存' | '更新' | '删除',
  ) => {
    if (r.authMessage) {
      setSyncHint(r.authMessage)
      toastError('无法完成操作', r.authMessage)
      return
    }
    if (r.validationError) {
      setSyncHint(r.validationError)
      toastError('校验未通过', r.validationError)
      return
    }
    if (r.dbError) {
      const line = `${dbFailVerb}失败：${r.dbError}`
      setSyncHint(line)
      toastError(`${dbFailVerb}失败`, r.dbError)
      return
    }
    const sync = r.sync
    if (!sync) return
    if (sync.errors.length > 0) {
      setSyncHint(
        `分类自动同步未完全成功：${sync.errors.join('；')}。可点击下方按钮重试。`,
      )
    } else {
      setSyncHint(null)
    }
  }

  const addRow = async () => {
    const trimmed = label.trim()
    const hrefTrim = href.trim()
    if (!trimmed || !hrefTrim) {
      const msg = !trimmed ? '请填写显示名称' : '请填写链接'
      setSyncHint(msg)
      toastError('无法添加', msg)
      return
    }
    const iconErr = validateNavIconName(iconName.trim() || null)
    if (iconErr) {
      setSyncHint(iconErr)
      toastError('无法添加', iconErr)
      return
    }
    const sortErr = validateNavSortOrder(sortOrder)
    if (sortErr) {
      setSyncHint(sortErr)
      toastError('无法添加', sortErr)
      return
    }
    const rowErr = validateNavigationMenuItem(sorted, {
      label: trimmed,
      href: hrefTrim,
      parent_id: parentId,
    })
    if (rowErr) {
      setSyncHint(rowErr)
      toastError('无法添加', rowErr)
      return
    }

    const r = await addNavigationMenuItemAction({
      label: trimmed,
      href: hrefTrim,
      icon_name: iconName.trim() || null,
      sort_order: sortOrder,
      parent_id: parentId,
      is_visible: visibleNew,
    })
    applyMutationSyncHint(r, '保存')
    if (r.authMessage || r.dbError) return
    toastIfCategoriesCreated(r.sync)
    setLabel('')
    setHref('/')
    setIconName('Sparkles')
    setSortOrder(100)
    setParentId(null)
    invalidate()
  }

  const updateField = async (
    id: string,
    patch: Partial<
      Pick<
        NavigationMenuItemRow,
        | 'label'
        | 'href'
        | 'icon_name'
        | 'sort_order'
        | 'parent_id'
        | 'is_visible'
      >
    >,
  ) => {
    const row = sorted.find((r) => r.id === id)
    if (!row) {
      toastError('更新失败', '找不到该菜单项，请刷新页面后重试')
      return
    }

    if (patch.icon_name !== undefined) {
      const ie = validateNavIconName(patch.icon_name)
      if (ie) {
        setSyncHint(ie)
        toastError('校验未通过', ie)
        return
      }
    }
    if (patch.sort_order !== undefined) {
      const se = validateNavSortOrder(Number(patch.sort_order))
      if (se) {
        setSyncHint(se)
        toastError('校验未通过', se)
        return
      }
    }

    const merged = { ...row, ...patch }
    const ve = validateNavigationMenuItem(sorted, {
      label: merged.label,
      href: merged.href,
      parent_id: merged.parent_id,
      excludeId: id,
    })
    if (ve) {
      setSyncHint(ve)
      toastError('校验未通过', ve)
      return
    }

    setBusyId(id)
    const r = await updateNavigationMenuItemAction(id, patch)
    applyMutationSyncHint(r, '更新')
    setBusyId(null)
    if (r.authMessage || r.dbError) return
    toastIfCategoriesCreated(r.sync)
    invalidate()
  }

  const removeRow = async (id: string) => {
    setBusyId(id)
    const r = await deleteNavigationMenuItemAction(id)
    applyMutationSyncHint(r, '删除')
    setBusyId(null)
    if (r.authMessage || r.dbError) return
    toastIfCategoriesCreated(r.sync)
    invalidate()
  }

  return (
    <div className="space-y-10">
      <div className="rounded-lg border border-border bg-card p-4 md:flex md:flex-wrap md:items-center md:justify-between md:gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">分类表与菜单</p>
          <p className="text-muted-foreground">
            保存菜单后会<strong className="font-medium text-foreground">自动</strong>
            把子菜单里的{' '}
            <code className="rounded bg-muted px-1">/category/xxx</code>{' '}
            同步到「分类」表（仅缺省时插入）。若同步失败会在此处提示，也可手动再点一次。
          </p>
          {syncHint ? (
            <p className="text-xs text-foreground whitespace-pre-wrap">{syncHint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 shrink-0 md:mt-0"
          disabled={isSyncing || isPending}
          onClick={async () => {
            setSyncHint(null)
            setIsSyncing(true)
            try {
              const r = await syncCategoriesFromNavigationAction()
              if (r.message) {
                setSyncHint(r.message)
                toastError('同步未完成', r.message)
              } else if (r.created > 0) {
                setSyncHint(
                  `已新增 ${r.created} 条分类：${r.slugs.join(', ')}`,
                )
                toastIfCategoriesCreated({
                  created: r.created,
                  slugs: r.slugs,
                })
              } else if (r.errors.length > 0) {
                setSyncHint(`未完成：${r.errors.join('；')}`)
                toastError('同步未完全成功', r.errors.join('；'))
              } else {
                setSyncHint('没有需要同步的项（子菜单 slug 在分类表里都已存在）。')
              }
              invalidate()
            } finally {
              setIsSyncing(false)
            }
          }}
        >
          {isSyncing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              同步中…
            </>
          ) : (
            '再次同步到分类表'
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">新增菜单项</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="nav-label">显示名称</Label>
            <Input
              id="nav-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="如 AI图像工具"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="nav-href">
              链接 / 锚点{' '}
              <span className="font-normal text-muted-foreground">
                （#/home-hot、/category/slug）
              </span>
            </Label>
            <Input
              id="nav-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="#home-hot 或 /category/ai-image"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nav-icon">Lucide 图标名</Label>
            <Input
              id="nav-icon"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              placeholder="Image / Flame …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nav-order">排序</Label>
            <Input
              id="nav-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end gap-3 pb-0.5">
            <Switch
              id="nav-visible-new"
              checked={visibleNew}
              onCheckedChange={setVisibleNew}
            />
            <Label htmlFor="nav-visible-new">前台可见</Label>
          </div>
          <div className="space-y-2">
            <Label>上级（留空为顶层）</Label>
            <Select
              value={parentId ?? 'none'}
              onValueChange={(v) => setParentId(v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="无" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无（顶层）</SelectItem>
                {sorted.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" className="mt-4 gap-2" onClick={() => void addRow()}>
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">全部条目</h2>
        <p className="text-sm text-muted-foreground">
          有子级的项会以折叠菜单展示（如图）。修改后前台约 10 分钟内可能仍缓存，可强刷新。
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">层级</th>
                <th className="p-3 font-medium">名称</th>
                <th className="p-3 font-medium">href</th>
                <th className="p-3 font-medium">图标</th>
                <th className="p-3 font-medium">排序</th>
                <th className="p-3 font-medium">可见</th>
                <th className="p-3 font-medium">上级</th>
                <th className="p-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((row) => {
                const forbid = descendantIds(row.id)
                const opts = sorted.filter(
                  (p) => p.id !== row.id && !forbid.has(p.id),
                )
                return (
                  <tr key={row.id} className="align-top hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">
                      {row.parent_id ? '子项' : '顶层'}
                    </td>
                    <td className="p-2">
                      <Input
                        defaultValue={row.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== row.label) updateField(row.id, { label: v })
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        defaultValue={row.href}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== row.href) updateField(row.id, { href: v })
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        defaultValue={row.icon_name ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          const next = v || null
                          if ((row.icon_name ?? '') !== v)
                            updateField(row.id, { icon_name: next })
                        }}
                      />
                    </td>
                    <td className="w-28 p-2">
                      <Input
                        type="number"
                        defaultValue={row.sort_order}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          if (!Number.isNaN(n) && n !== row.sort_order)
                            updateField(row.id, { sort_order: n })
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <Switch
                        checked={row.is_visible}
                        disabled={busyId === row.id}
                        onCheckedChange={(c) =>
                          updateField(row.id, { is_visible: c })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={row.parent_id ?? 'none'}
                        onValueChange={(v) =>
                          updateField(row.id, {
                            parent_id: v === 'none' ? null : v,
                          })
                        }
                        disabled={busyId === row.id}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="顶层" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">无</SelectItem>
                          {opts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        type="button"
                        disabled={busyId === row.id || isPending}
                        onClick={() => void removeRow(row.id)}
                      >
                        {busyId === row.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
