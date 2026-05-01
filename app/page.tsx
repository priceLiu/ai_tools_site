import { createClient } from '@/lib/supabase/server'
import { getHomeToolBundle } from '@/lib/cached-home-data'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { HomeToolSections } from '@/components/home-tool-sections'
import { Sparkles } from 'lucide-react'
import type { Profile } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: authData }, bundle] = await Promise.all([
    supabase.auth.getUser(),
    getHomeToolBundle(),
  ])

  const user = authData.user

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar categories={bundle.categories} enableHomeAnchors />

      <div className="pl-16 md:pl-64">
        <Header user={user} profile={profile} />

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
