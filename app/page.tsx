import { Sidebar } from '@/components/sidebar'
import { HeaderUser } from '@/components/header-user'
import { HomeToolSections } from '@/components/home-tool-sections'
import { HomeScrollToHash } from '@/components/home-scroll-to-hash'
import { Sparkles } from 'lucide-react'
import { getHomeToolBundle } from '@/lib/cached-home-data'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'

/** ISR：60s TTL；后台变更通过 `revalidateTag` / `revalidatePath('/')` 立即推送 */
export const revalidate = 60

export default async function HomePage() {
  const [bundle, navigation] = await Promise.all([
    getHomeToolBundle(),
    getNavigationMenuTreeStatic(),
  ])

  return (
    <div className="min-h-screen bg-background">
      <HomeScrollToHash />
      <Sidebar navigation={navigation} enableHomeAnchors />

      <div className="pl-16 md:pl-64">
        <HeaderUser />

        <main className="p-4 md:p-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              AI工具集
            </h1>
            <p className="mt-2 text-muted-foreground">发现全网最好用的AI工具</p>
          </div>

          <HomeToolSections bundle={bundle} />
        </main>
      </div>
    </div>
  )
}
