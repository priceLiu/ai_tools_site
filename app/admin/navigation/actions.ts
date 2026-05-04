'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { NAVIGATION_MENU_CACHE_TAG } from '@/lib/navigation-menu-cache-config'
import { syncMissingCategoriesFromNavigation } from '@/lib/sync-categories-from-navigation'
import * as neon from '@/lib/neon/data'
import type { NavigationMenuItemRow } from '@/lib/types'
import {
  validateNavIconName,
  validateNavigationMenuItem,
  validateNavSortOrder,
} from '@/lib/nav-menu-validation'
import {
  collectMenuSubtreeHrefsBeforeDelete,
  tryDeleteOrphanCategoryFromNavHref,
} from '@/lib/orphan-category-cleanup'

export async function revalidateNavigationMenuCache() {
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
}

export type SyncCategoriesFromNavigationResult = {
  ok: boolean
  created: number
  slugs: string[]
  errors: string[]
  message?: string
}

async function revalidateAfterNavOrCategoriesChange() {
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
  revalidatePath('/submit')
  revalidatePath('/admin/navigation')
  /** 分类页 ISR：所有 /category/[slug] 一次性失效；首页由 home action 内部 revalidatePath('/') 处理 */
  revalidatePath('/category/[slug]', 'page')
  await revalidateHomeToolBundleAction()
}

async function syncMissingCategoriesAfterNavChange(): Promise<
  Omit<SyncCategoriesFromNavigationResult, 'message'>
> {
  const [navRows, catRows] = await Promise.all([
    neon.neonListNavigationForAdmin(),
    neon.neonListCategoriesAll(),
  ])
  const res = await syncMissingCategoriesFromNavigation(navRows, catRows)
  await revalidateAfterNavOrCategoriesChange()
  const ok = res.created > 0 || res.errors.length === 0
  return { ok, created: res.created, slugs: res.slugs, errors: res.errors }
}

/** 把侧栏折叠下一层子菜单补进 categories：有效 /category/slug 优先；否则按子项标题生成 slug（仅缺省插入） */
export async function syncCategoriesFromNavigationAction(): Promise<SyncCategoriesFromNavigationResult> {
  const user = await getAuthUser()
  if (!user) {
    return {
      ok: false,
      created: 0,
      slugs: [],
      errors: [],
      message: '未登录',
    }
  }

  const isAdmin = await neon.neonGetProfileIsAdmin(user.id)
  if (!isAdmin) {
    return {
      ok: false,
      created: 0,
      slugs: [],
      errors: [],
      message: '无权限',
    }
  }

  return syncMissingCategoriesAfterNavChange()
}

async function requireAdminNav() {
  const user = await getAuthUser()
  if (!user) return { user: null as null, admin: false }
  const admin = await neon.neonGetProfileIsAdmin(user.id)
  return { user, admin }
}

export type NavMenuMutationResult = {
  authMessage?: string
  validationError?: string
  dbError?: string
  sync?: Omit<SyncCategoriesFromNavigationResult, 'message'>
}

/** 在同一请求内写入菜单并同步分类表，避免客户端写入后服务端读不到最新行 */
export async function addNavigationMenuItemAction(input: {
  label: string
  href: string
  icon_name: string | null
  sort_order: number
  parent_id: string | null
  is_visible: boolean
}): Promise<NavMenuMutationResult> {
  const { user, admin } = await requireAdminNav()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  const iconErr = validateNavIconName(input.icon_name)
  if (iconErr) return { validationError: iconErr }
  const sortErr = validateNavSortOrder(Number(input.sort_order))
  if (sortErr) return { validationError: sortErr }

  const rows = await neon.neonListNavigationMenuItemsMinimal()

  const ve = validateNavigationMenuItem(rows ?? [], {
    label: input.label,
    href: input.href,
    parent_id: input.parent_id,
  })
  if (ve) return { validationError: ve }

  try {
    await neon.neonInsertNavigationItem({
      label: input.label,
      href: input.href,
      icon_name: input.icon_name,
      sort_order: input.sort_order,
      parent_id: input.parent_id,
      is_visible: input.is_visible,
    })
  } catch (e) {
    return { dbError: e instanceof Error ? e.message : String(e) }
  }
  return { sync: await syncMissingCategoriesAfterNavChange() }
}

export async function updateNavigationMenuItemAction(
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
): Promise<NavMenuMutationResult> {
  const { user, admin } = await requireAdminNav()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  let current: NavigationMenuItemRow | null = null
  try {
    current = await neon.neonGetNavigationMenuItemById(id)
  } catch (e) {
    return { dbError: e instanceof Error ? e.message : String(e) }
  }

  if (!current) return { validationError: '该菜单项不存在或已被删除' }

  const merged: NavigationMenuItemRow = {
    ...current,
    ...patch,
  }

  if (patch.icon_name !== undefined) {
    const ie = validateNavIconName(patch.icon_name)
    if (ie) return { validationError: ie }
  }
  if (patch.sort_order !== undefined) {
    const se = validateNavSortOrder(Number(patch.sort_order))
    if (se) return { validationError: se }
  }

  const valRows = await neon.neonListNavigationMenuItemsMinimal()

  const ve = validateNavigationMenuItem(valRows ?? [], {
    label: merged.label,
    href: merged.href,
    parent_id: merged.parent_id,
    excludeId: id,
  })
  if (ve) return { validationError: ve }

  try {
    await neon.neonMergePatchNavigationMenuItem(id, patch)
  } catch (e) {
    return { dbError: e instanceof Error ? e.message : String(e) }
  }
  if (
    patch.href !== undefined &&
    typeof current.href === 'string' &&
    merged.href !== current.href
  ) {
    await tryDeleteOrphanCategoryFromNavHref(current.href)
  }
  return { sync: await syncMissingCategoriesAfterNavChange() }
}

export async function deleteNavigationMenuItemAction(
  id: string,
): Promise<NavMenuMutationResult> {
  const { user, admin } = await requireAdminNav()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  const hrefsToCheck = await collectMenuSubtreeHrefsBeforeDelete(id)

  try {
    await neon.neonDeleteNavigationItem(id)
  } catch (e) {
    return { dbError: e instanceof Error ? e.message : String(e) }
  }
  for (const h of hrefsToCheck) {
    await tryDeleteOrphanCategoryFromNavHref(h)
  }
  return { sync: await syncMissingCategoriesAfterNavChange() }
}
