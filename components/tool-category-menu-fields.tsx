'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SubmitNavigationCategoryTier1 } from '@/lib/submit-category-choices'

export const TOOL_CATEGORY_MENU_NONE = '__tool_cat_menu_none__'

export function ToolCategoryMenuFields({
  idPrefix,
  tier1,
  primaryIdx,
  leafId,
  onPrimaryChange,
  onLeafChange,
}: {
  idPrefix: string
  tier1: SubmitNavigationCategoryTier1[]
  primaryIdx: number
  leafId: string
  /** 传入选中的 tier1 下标字符串，或 TOOL_CATEGORY_MENU_NONE 清空 */
  onPrimaryChange: (indexOrNone: string) => void
  onLeafChange: (categoryIdOrNone: string) => void
}) {
  const currentRowWithLeaf = primaryIdx >= 0 ? tier1[primaryIdx] : undefined
  const currentRow = currentRowWithLeaf
  const showLeafSelect =
    currentRow?.kind === 'menu_group' && currentRow.children.length >= 1
  const leafInList =
    currentRowWithLeaf?.kind === 'menu_group' &&
    leafId &&
    currentRowWithLeaf.children.some((c) => c.categoryId === leafId)
  const leafSelectValue = leafInList
    ? leafId
    : TOOL_CATEGORY_MENU_NONE

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-2">
        <Label
          htmlFor={`${idPrefix}-primary`}
          className="text-xs font-medium text-muted-foreground"
        >
          分类入口
        </Label>
        <Select
          value={primaryIdx < 0 ? TOOL_CATEGORY_MENU_NONE : String(primaryIdx)}
          onValueChange={onPrimaryChange}
        >
          <SelectTrigger
            id={`${idPrefix}-primary`}
            className="h-10 w-full bg-background"
          >
            <SelectValue placeholder="请选择分类入口" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
          >
            <SelectItem value={TOOL_CATEGORY_MENU_NONE}>
              请选择分类入口
            </SelectItem>
            {tier1.map((row, i) => (
              <SelectItem
                key={
                  row.kind === 'menu_group'
                    ? `g-${row.navParentId}`
                    : `l-${row.categoryId}`
                }
                value={String(i)}
              >
                {row.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showLeafSelect && currentRow?.kind === 'menu_group' ? (
        <div className="min-w-0 flex-1 space-y-2">
          <Label
            htmlFor={`${idPrefix}-leaf`}
            className="text-xs font-medium text-muted-foreground"
          >
            具体分类
          </Label>
          <Select
            value={leafSelectValue}
            onValueChange={onLeafChange}
          >
            <SelectTrigger
              id={`${idPrefix}-leaf`}
              className="h-10 w-full bg-background"
            >
              <SelectValue placeholder="请选择具体分类" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
            >
              <SelectItem value={TOOL_CATEGORY_MENU_NONE}>
                请选择具体分类
              </SelectItem>
              {currentRow.children.map((ch) => (
                <SelectItem key={ch.categoryId} value={ch.categoryId}>
                  {ch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}
