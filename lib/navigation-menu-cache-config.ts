/**
 * 与 `getNavigationMenuTree` 的 unstable_cache tag 一致；可安全用于 Client/Server 任意处。
 * `HOME_TOOL_BUNDLE_CACHE_TAG`：首页 `getHomeToolBundle` 的快照；工具审批/热门等变更后需 revalidate。
 */
export const NAVIGATION_MENU_CACHE_TAG = 'navigation-menu'
export const NAVIGATION_MENU_CACHE_REVALIDATE_SECONDS = 600

export const HOME_TOOL_BUNDLE_CACHE_TAG = 'home-tool-bundle'
