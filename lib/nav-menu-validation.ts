import type { NavigationMenuItemRow } from '@/lib/types'
import { slugFromCategoryMenuHref } from '@/lib/submit-category-choices'

const MAX_LABEL_LEN = 80
const MAX_HREF_LEN = 500
const MAX_ICON_NAME_LEN = 64

/** 用于判断「显示名称是否实质相同」（去空白差异、大小写） */
export function normalizeNavMenuLabelKey(label: string): string {
  return label.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type NavMenuValidateInput = {
  label: string
  href: string
  parent_id: string | null
  /** 更新时排除自身 */
  excludeId?: string
}

/**
 * 导航菜单项校验：全表显示名称去重；同一上级下链接不可重复；分类链接 slug 字符集；外链格式。
 */
export function validateNavigationMenuItem(
  rows: Pick<NavigationMenuItemRow, 'id' | 'label' | 'href' | 'parent_id'>[],
  input: NavMenuValidateInput,
): string | null {
  const label = input.label.trim()
  const href = input.href.trim()
  if (!label) return '显示名称不能为空'
  if (!href) return '链接不能为空'
  if (label.length > MAX_LABEL_LEN) {
    return `显示名称过长（最多 ${MAX_LABEL_LEN} 字）`
  }
  if (href.length > MAX_HREF_LEN) {
    return `链接过长（最多 ${MAX_HREF_LEN} 字符）`
  }

  const labelKey = normalizeNavMenuLabelKey(label)
  for (const r of rows) {
    if (input.excludeId && r.id === input.excludeId) continue
    if (normalizeNavMenuLabelKey(r.label) === labelKey) {
      return '已存在相同显示名称的菜单项（忽略大小写与多余空格），请换一个名称'
    }
  }

  const parentKey = input.parent_id ?? '__root__'
  for (const r of rows) {
    if (input.excludeId && r.id === input.excludeId) continue
    const pk = r.parent_id ?? '__root__'
    if (pk === parentKey && r.href.trim() === href) {
      return '同一上级下已存在相同链接，请修改链接或上级'
    }
  }

  const catSlug = slugFromCategoryMenuHref(href)
  if (catSlug && catSlug !== 'hot') {
    if (!/^[a-zA-Z0-9_-]+$/.test(catSlug)) {
      return '分类链接中的 slug 仅允许英文字母、数字、下划线与连字符'
    }
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      new URL(href)
    } catch {
      return '外链地址格式无效，请检查是否完整（含 https://）'
    }
  }

  return null
}

export function validateNavIconName(iconName: string | null | undefined): string | null {
  if (iconName == null || String(iconName).trim() === '') return null
  const s = String(iconName).trim()
  if (s.length > MAX_ICON_NAME_LEN) {
    return `图标名过长（最多 ${MAX_ICON_NAME_LEN} 字符）`
  }
  if (/\s/.test(s)) return '图标名不能包含空格'
  return null
}

export function validateNavSortOrder(n: number): string | null {
  if (!Number.isFinite(n)) return '排序必须是数字'
  if (!Number.isInteger(n)) return '排序须为整数'
  if (n < -1_000_000 || n > 1_000_000) {
    return '排序超出合理范围（-1000000～1000000）'
  }
  return null
}
