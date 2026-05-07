/**
 * 与 `getNavigationMenuTree` 的 unstable_cache tag 一致；可安全用于 Client/Server 任意处。
 * `HOME_TOOL_BUNDLE_CACHE_TAG`：`revalidateTag` 仍可用于其它 Data Cache；首页主体数据优先来自 Supabase Storage 快照（见 `getHomeToolBundle`）。
 */
export const NAVIGATION_MENU_CACHE_TAG = 'navigation-menu'
export const NAVIGATION_MENU_CACHE_REVALIDATE_SECONDS = 600

export const HOME_TOOL_BUNDLE_CACHE_TAG = 'home-tool-bundle'

/** 首页广告位（section1 / section2）数据缓存；写后调用 revalidateTag(...) 立即刷新 */
export const HOME_ADS_CACHE_TAG = 'home-ads'

/** 首页「按角色」条带数据缓存；角色 / 标签 / 工具写入时同步失效 */
export const HOME_ROLE_CATEGORIES_CACHE_TAG = 'home-role-categories'

/** 首页「按场景找 AI」8 卡片区数据缓存；标签写入 / 合并 / 删除时同步失效 */
export const HOME_TAG_CATEGORIES_CACHE_TAG = 'home-tag-categories'

/**
 * 自动提取标签用全库字典缓存；标签新建 / 改名 / 合并 / 删除 / curated 或场景分类变更时一并失效。
 */
export const TAG_SUGGEST_DICTIONARY_CACHE_TAG = 'tag-suggest-dictionary'
