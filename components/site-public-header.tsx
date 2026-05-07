import { getHomeRoleStrip } from '@/lib/cached-home-role-strip'
import { HeaderUser } from '@/components/header-user'
import { PublicRoleStrip } from '@/components/public-role-strip'
import type { NavigationMenuTreeNode } from '@/lib/types'

/**
 * 前台侧栏布局共用顶栏：首行客户端态 Header + 搜索，其下全站「按角色」横条。
 */
export async function SitePublicHeader({
  navigation = [],
  enableHomeAnchors = false,
}: {
  navigation?: NavigationMenuTreeNode[]
  enableHomeAnchors?: boolean
}) {
  const rolesStrip = await getHomeRoleStrip()
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <HeaderUser navigation={navigation} enableHomeAnchors={enableHomeAnchors} />
      <PublicRoleStrip roles={rolesStrip} />
    </div>
  )
}
