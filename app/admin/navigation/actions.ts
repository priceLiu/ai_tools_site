'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { revalidateHomeToolBundleAction } from '@/app/actions/revalidate-home-tool-bundle'
import { NAVIGATION_MENU_CACHE_TAG } from '@/lib/navigation-menu-cache-config'
import { syncMissingCategoriesFromNavigation } from '@/lib/sync-categories-from-navigation'
import type { Category, NavigationMenuItemRow } from '@/lib/types'
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
  revalidatePath('/')
  revalidatePath('/submit')
  revalidatePath('/admin/navigation')
  await revalidateHomeToolBundleAction()
}

async function syncMissingCategoriesWithServerClient(
  supabaseClient?: Awaited<ReturnType<typeof createClient>>,
): Promise<Omit<SyncCategoriesFromNavigationResult, 'message'>> {
  const supabase = supabaseClient ?? (await createClient())
  const [{ data: navRows }, { data: catRows }] = await Promise.all([
    supabase.from('navigation_menu_items').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
  ])
  const res = await syncMissingCategoriesFromNavigation(
    supabase,
    (navRows ?? []) as NavigationMenuItemRow[],
    (catRows ?? []) as Category[],
  )
  await revalidateAfterNavOrCategoriesChange()
  const ok = res.created > 0 || res.errors.length === 0
  return { ok, created: res.created, slugs: res.slugs, errors: res.errors }
}

/** 把侧栏折叠下一层子菜单补进 categories：有效 /category/slug 优先；否则按子项标题生成 slug（仅缺省插入） */
export async function syncCategoriesFromNavigationAction(): Promise<SyncCategoriesFromNavigationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      created: 0,
      slugs: [],
      errors: [],
      message: '未登录',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return {
      ok: false,
      created: 0,
      slugs: [],
      errors: [],
      message: '无权限',
    }
  }

  return syncMissingCategoriesWithServerClient(supabase)
}

async function requireAdminClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, admin: false }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return { supabase, user, admin: Boolean(profile?.is_admin) }
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
  const { supabase, user, admin } = await requireAdminClient()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  const iconErr = validateNavIconName(input.icon_name)
  if (iconErr) return { validationError: iconErr }
  const sortErr = validateNavSortOrder(Number(input.sort_order))
  if (sortErr) return { validationError: sortErr }

  const { data: rows } = await supabase
    .from('navigation_menu_items')
    .select('id,label,href,parent_id')
  const ve = validateNavigationMenuItem(rows ?? [], {
    label: input.label,
    href: input.href,
    parent_id: input.parent_id,
  })
  if (ve) return { validationError: ve }

  const { error } = await supabase.from('navigation_menu_items').insert({
    label: input.label,
    href: input.href,
    icon_name: input.icon_name,
    sort_order: input.sort_order,
    parent_id: input.parent_id,
    is_visible: input.is_visible,
  })
  if (error) return { dbError: error.message }
  return { sync: await syncMissingCategoriesWithServerClient(supabase) }
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
  const { supabase, user, admin } = await requireAdminClient()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  const { data: current, error: fetchErr } = await supabase
    .from('navigation_menu_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { dbError: fetchErr.message }
  if (!current) return { validationError: '该菜单项不存在或已被删除' }

  const merged: NavigationMenuItemRow = {
    ...(current as NavigationMenuItemRow),
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

  const { data: rows } = await supabase
    .from('navigation_menu_items')
    .select('id,label,href,parent_id')
  const ve = validateNavigationMenuItem(rows ?? [], {
    label: merged.label,
    href: merged.href,
    parent_id: merged.parent_id,
    excludeId: id,
  })
  if (ve) return { validationError: ve }

  const { error } = await supabase
    .from('navigation_menu_items')
    .update(patch)
    .eq('id', id)
  if (error) return { dbError: error.message }

  if (
    patch.href !== undefined &&
    typeof current.href === 'string' &&
    merged.href !== current.href
  ) {
    await tryDeleteOrphanCategoryFromNavHref(supabase, current.href)
  }

  return { sync: await syncMissingCategoriesWithServerClient(supabase) }
}

export async function deleteNavigationMenuItemAction(
  id: string,
): Promise<NavMenuMutationResult> {
  const { supabase, user, admin } = await requireAdminClient()
  if (!user) return { authMessage: '未登录' }
  if (!admin) return { authMessage: '无权限' }

  const hrefsToCheck = await collectMenuSubtreeHrefsBeforeDelete(supabase, id)

  const { error } = await supabase
    .from('navigation_menu_items')
    .delete()
    .eq('id', id)
  if (error) return { dbError: error.message }

  for (const h of hrefsToCheck) {
    await tryDeleteOrphanCategoryFromNavHref(supabase, h)
  }
  return { sync: await syncMissingCategoriesWithServerClient(supabase) }
}