'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { NAVIGATION_MENU_CACHE_TAG } from '@/lib/navigation-menu'
import { syncMissingCategoriesFromNavigation } from '@/lib/sync-categories-from-navigation'
import type { Category, NavigationMenuItemRow } from '@/lib/types'

export async function revalidateNavigationMenuCache() {
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
}

/** 把侧栏里 /category/slug 子菜单对应的行补进 categories（仅缺省时插入） */
export async function syncCategoriesFromNavigationAction(): Promise<{
  ok: boolean
  created: number
  slugs: string[]
  errors: string[]
  message?: string
}> {
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

  const [{ data: navRows }, { data: catRows }] = await Promise.all([
    supabase.from('navigation_menu_items').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
  ])

  const res = await syncMissingCategoriesFromNavigation(
    supabase,
    (navRows ?? []) as NavigationMenuItemRow[],
    (catRows ?? []) as Category[],
  )

  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })

  const ok = res.created > 0 || res.errors.length === 0
  return {
    ok,
    created: res.created,
    slugs: res.slugs,
    errors: res.errors,
  }
}
