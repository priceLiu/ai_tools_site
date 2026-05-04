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

      <div className="md:pl-64">
        <HeaderUser navigation={navigation} enableHomeAnchors />

        <main className="px-3 py-4 sm:px-4 md:p-6">
          <div className="mb-6 text-center md:mb-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 md:mb-4 md:h-16 md:w-16">
              <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
            </div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl">
              AI工具集
            </h1>
            <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">
              发现全网最好用的AI工具
            </p>
          </div>

          <HomeToolSections bundle={bundle} />
        </main>
      </div>
    </div>
  )
}
