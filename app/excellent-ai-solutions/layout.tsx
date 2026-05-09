import type { ReactNode } from 'react'
import { Sidebar } from '@/components/sidebar'
import { SitePublicHeader } from '@/components/site-public-header'
import { getNavigationMenuTreeStatic } from '@/lib/navigation-menu'

export default async function ExcellentSolutionsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const navigation = await getNavigationMenuTreeStatic()
  return (
    <div className="min-h-screen bg-background">
      <Sidebar navigation={navigation} />
      <div className="md:pl-[162px]">
        <SitePublicHeader navigation={navigation} />
        {children}
      </div>
    </div>
  )
}
