'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth/session'
import { neonGetProfileIsAdmin } from '@/lib/neon/data'
import { loadHomeToolBundle } from '@/lib/cached-home-data'
import { uploadHomeToolBundleSnapshot } from '@/lib/home-bundle-snapshot'
import {
  HOME_ADS_CACHE_TAG,
  HOME_TAG_CATEGORIES_CACHE_TAG,
  HOME_TOOL_BUNDLE_CACHE_TAG,
  NAVIGATION_MENU_CACHE_TAG,
} from '@/lib/navigation-menu-cache-config'

/**
 * 工具/分类等影响首页列表时调用。
 *
 * `getHomeToolBundle()` **优先读 `app_kv` 快照**。若先发 `revalidateTag`、再在 `after()` 里异步写快照，
 * 下一轮 Data Cache 重建会立刻用**旧快照**把缓存填满，要到下次失效或手动「生成静态」才纠正。
 *
 * 因此顺序必须是：**先从 Neon 拉齐 bundle → 写入 `app_kv`**，再失效 tag + `/` 的 ISR。
 *
 * 同步失效 `HOME_ADS_CACHE_TAG`：广告位展示关联工具（名称 / logo 等），审核上线或编辑已通过工具后应与首页一致刷新。
 *
 * 这里的告警必须在 production 也打出来——之前用 NODE_ENV='development' 门控，
 * CloudBase Run 上首页快照重建失败时完全静默，要靠点「手动生成静态」才纠正。
 */
export async function revalidateHomeToolBundleAction(): Promise<{
  scheduled: true
}> {
  try {
    const bundle = await loadHomeToolBundle()
    const uploaded = await uploadHomeToolBundleSnapshot(bundle)
    if (!uploaded.ok) {
      console.warn('[revalidateHomeToolBundle] snapshot upload failed:', uploaded.error)
    } else {
      console.info(
        '[revalidateHomeToolBundle] snapshot ok',
        `categories=${bundle.categories.length}`,
        `featured=${bundle.featured.length}`,
        `latest=${bundle.latest.length}`,
        `blocks=${bundle.homeCategoryBlocks.length}`,
      )
    }
  } catch (e) {
    console.warn(
      '[revalidateHomeToolBundle] snapshot rebuild failed:',
      e instanceof Error ? e.message : String(e),
    )
  }

  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
  revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
  /** 与 `regeneratePublicStaticAction` 等价：导航菜单也可能因工具变动需要刷新（隐藏空分类等）。 */
  revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
  revalidatePath('/')

  return { scheduled: true }
}

/**
 * 管理员手动「生成静态」：一键失效全站静态缓存（首页 / 分类 / 详情 / 导航 + 首页 bundle Data Cache）
 * 并同步重建 `app_kv` 首页快照，方便上线后立刻拿到最新 HTML。
 *
 * Next.js 的 ISR 失效是「下一次访问触发重建」，所以这里相当于「按发布」：
 * - 失效后立即可见的页面，浏览器再次请求时会拿到最新 HTML。
 * - 动态岛（收藏数 / 评论 / 用户登录态）走客户端 fetch，不依赖 ISR。
 */
export async function regeneratePublicStaticAction(): Promise<{
  ok: boolean
  message: string
}> {
  const user = await getAuthUser()
  if (!user) return { ok: false, message: '未登录' }

  const ok = await neonGetProfileIsAdmin(user.id)
  if (!ok) return { ok: false, message: '无权限' }

  try {
    const bundle = await loadHomeToolBundle()
    const uploaded = await uploadHomeToolBundleSnapshot(bundle)

    revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
    revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
    revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
    revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
    revalidatePath('/')
    revalidatePath('/category/[slug]', 'page')
    revalidatePath('/tool/[slug]', 'page')
    revalidatePath('/tag-category/[slug]', 'page')
    revalidatePath('/tag/[slug]', 'page')
    revalidatePath('/role/[slug]', 'page')

    if (uploaded.ok) {
      return {
        ok: true,
        message: '已生成静态：首页 / 分类 / 详情 ISR 已失效，首页快照已重建。',
      }
    }
    return {
      ok: true,
      message: `静态页缓存已失效。app_kv 快照未写入：${uploaded.error ?? '请检查 DATABASE_URL 与 app_kv 表'}。`,
    }
  } catch (e) {
    revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
    revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
    revalidateTag(HOME_ADS_CACHE_TAG, { expire: 0 })
    revalidateTag(HOME_TAG_CATEGORIES_CACHE_TAG, { expire: 0 })
    revalidatePath('/')
    revalidatePath('/category/[slug]', 'page')
    revalidatePath('/tool/[slug]', 'page')
    revalidatePath('/tag-category/[slug]', 'page')
    revalidatePath('/tag/[slug]', 'page')
    revalidatePath('/role/[slug]', 'page')
    return {
      ok: true,
      message: `静态页缓存已失效。快照重建失败：${e instanceof Error ? e.message : String(e)}`,
    }
  }
}
