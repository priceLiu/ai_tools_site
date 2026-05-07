import { getAuthUser } from '@/lib/auth/session'
import * as neon from '@/lib/neon/data'
import { AccountFollowsPanel } from '@/components/account-follows-panel'

export const metadata = {
  title: '我的关注 - 个人中心',
  robots: { index: false, follow: false } as const,
}

export default async function AccountFollowsPage() {
  const user = await getAuthUser()
  if (!user) return null

  const [enabledScenes, enabledRoles, sceneFollows, roleFollows, toolFollows] =
    await Promise.all([
      neon.neonListTagCategoriesEnabled(),
      neon.neonListRoleCategoriesEnabled(),
      neon.neonListUserFollowTagCategoriesJoined(user.id),
      neon.neonListUserFollowRoleCategoriesJoined(user.id),
      neon.neonListUserFollowToolsForAccount(user.id),
    ])

  return (
    <AccountFollowsPanel
      enabledScenes={enabledScenes}
      enabledRoles={enabledRoles}
      initialSceneFollows={sceneFollows}
      initialRoleFollows={roleFollows}
      initialToolFollows={toolFollows}
    />
  )
}
