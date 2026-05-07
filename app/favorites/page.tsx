import { getAuthUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AccountChromeWithRoleStrip } from '@/components/account-chrome-with-role-strip'
import { ToolCard } from '@/components/tool-card'
import { Heart, Sparkles } from 'lucide-react'
import type { Tool, Profile } from '@/lib/types'
import { getSessionProfile } from '@/lib/server-profile'
import * as neon from '@/lib/neon/data'

export const metadata = {
  title: '我的收藏',
  robots: { index: false, follow: false },
}

export default async function FavoritesPage() {
  const user = await getAuthUser()

  if (!user) {
    redirect('/auth/login?redirect=/favorites')
  }

  const profile = await getSessionProfile(user.id)

  const favRows = await neon.neonListFavoritesWithToolsForUser(user.id)

  const favorites = favRows.map((f) => ({
    id: f.id,
    tool_id: f.tool.id,
    created_at: f.created_at,
    tool: f.tool,
  }))

  const validFavorites =
    favorites?.filter((f) => {
      const raw = f.tool as unknown
      const t = (Array.isArray(raw) ? raw[0] : raw) as Tool | undefined
      return t && t.status === 'approved' && !t.is_disabled
    }) || []

  return (
    <AccountChromeWithRoleStrip user={user} profile={profile as Profile}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <Heart className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">我的收藏</h1>
              <p className="text-sm text-muted-foreground">
                共收藏 {validFavorites.length} 个工具
              </p>
            </div>
          </div>
        </div>

        {validFavorites.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
            {validFavorites.map((favorite) => {
              const raw = favorite.tool as unknown
              const t = (Array.isArray(raw) ? raw[0] : raw) as Tool
              return (
                <ToolCard
                  key={favorite.id}
                  tool={t}
                />
              )
            })}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              还没有收藏
            </h2>
            <p className="mt-2 text-muted-foreground">
              浏览工具并点击心形图标来收藏喜欢的工具
            </p>
          </div>
        )}
      </div>
    </AccountChromeWithRoleStrip>
  )
}
