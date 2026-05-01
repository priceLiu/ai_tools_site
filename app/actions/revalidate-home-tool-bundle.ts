'use server'

import { revalidateTag } from 'next/cache'
import { HOME_TOOL_BUNDLE_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

/** 已通过工具 / 热门位 等变更后调用，使首页 `getHomeToolBundle` 缓存失效并下一请求重建 */
export async function revalidateHomeToolBundleAction() {
  revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG, { expire: 0 })
}
