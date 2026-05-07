'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { adminCreateTagAction } from '@/app/admin/tags/actions'
import type { Category, RoleCategory, TagCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'

export type AdminTagCreateCardProps =
  | { variant: 'scene'; tagCategories: TagCategory[] }
  | { variant: 'role'; roleCategories: RoleCategory[] }
  | { variant: 'menu'; menuCategories: Category[] }

export function AdminTagCreateCard(props: AdminTagCreateCardProps) {
  const router = useRouter()
  const variant = props.variant

  const initialPick =
    variant === 'scene'
      ? props.tagCategories[0]?.id ?? ''
      : variant === 'role'
        ? props.roleCategories[0]?.id ?? ''
        : props.menuCategories[0]?.id ?? ''

  const [name, setName] = useState('')
  const [pickedId, setPickedId] = useState(initialPick)
  const [isCurated, setIsCurated] = useState(true)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const submit = () => {
    setMessage(null)
    const n = name.normalize('NFKC').trim()
    if (!n) {
      setMessage('请输入标签名称')
      return
    }
    if (!pickedId) {
      setMessage(
        variant === 'scene'
          ? '请选择场景分类'
          : variant === 'role'
            ? '请选择角色分类'
            : '请选择菜单分类',
      )
      return
    }

    startTransition(async () => {
      const r =
        variant === 'scene'
          ? await adminCreateTagAction({
              kind: 'scene',
              name: n,
              tagCategoryId: pickedId,
              isCurated,
            })
          : variant === 'role'
            ? await adminCreateTagAction({
                kind: 'role',
                name: n,
                roleCategoryId: pickedId,
                isCurated,
              })
            : await adminCreateTagAction({
                kind: 'menu',
                name: n,
                menuCategoryId: pickedId,
                isCurated,
              })

      if (!r.ok) {
        setMessage(r.error ?? '创建失败')
        return
      }
      setName('')
      setMessage(
        variant === 'scene'
          ? `已创建标签（场景归属已写入），id=${r.id}`
          : variant === 'role'
            ? `已创建标签并已关联所选角色分类（弱联结），id=${r.id}`
            : `已创建标签并已关联所选菜单分类（弱联结），id=${r.id}`,
      )
      router.refresh()
    })
  }

  const pickerEmpty =
    variant === 'scene'
      ? props.tagCategories.length === 0
      : variant === 'role'
        ? props.roleCategories.length === 0
        : props.menuCategories.length === 0

  const pickerLabel =
    variant === 'scene'
      ? '场景分类'
      : variant === 'role'
        ? '角色分类'
        : '菜单分类'

  const description =
    variant === 'scene'
      ? '访客提交工具时仅能使用「自动提取标签」，词表自此入口与清洗流程扩展；名称库内唯一。此处选择的「场景分类」写入 tags.tag_category_id，用于 /tag-category 运营编排。'
      : variant === 'role'
        ? '自动提取与词典匹配仍可读到此标签。此处仅选择「角色分类」：创建后会写入 role_category_tags，不修改 tags.tag_category_id；场景归属可在「场景分类管理」或「标签管理」另选。'
        : '自动提取与词典匹配仍可读到此标签。此处仅选择「菜单分类」（左侧产品线 categories）：创建后会写入 category_tags，不改变工具的 category_id，也不写入标签的场景归属；后者可在「场景分类管理」维护。'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">新建标签（可控词表）</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 space-y-1.5 sm:max-w-[200px]">
          <Label htmlFor="new-tag-name" className="text-xs">
            标签名称
          </Label>
          <Input
            id="new-tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：短视频脚本"
            disabled={pending}
          />
        </div>
        <div className="flex-1 space-y-1.5 sm:max-w-[220px]">
          <Label htmlFor="new-tag-picker" className="text-xs">
            {pickerLabel}
          </Label>
          <select
            id="new-tag-picker"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={pickedId}
            disabled={pending || pickerEmpty}
            onChange={(e) => setPickedId(e.target.value)}
          >
            {pickerEmpty ? (
              <option value="">
                {variant === 'scene'
                  ? '无场景分类数据'
                  : variant === 'role'
                    ? '无角色分类数据'
                    : '无菜单分类数据'}
              </option>
            ) : null}
            {variant === 'scene'
              ? props.tagCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_disabled ? '（场景已禁用）' : ''}
                  </option>
                ))
              : variant === 'role'
                ? props.roleCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_disabled ? '（已禁用）' : ''}
                    </option>
                  ))
                : props.menuCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_disabled ? '（已禁用）' : ''}
                    </option>
                  ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isCurated}
            disabled={pending}
            onCheckedChange={(v) => setIsCurated(v === true)}
          />
          标为 curated
        </label>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={pending}
          className="sm:shrink-0"
        >
          {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
          创建
        </Button>
        {message ? (
          <p className="w-full text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
