'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'
import {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
  Sparkles,
  Plus,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const iconMap: Record<string, LucideIcon> = {
  Flame,
  MessageCircle,
  Image,
  Video,
  Music,
  PenTool,
  Code,
  Palette,
  Briefcase,
  Search,
  GraduationCap,
  TrendingUp,
}

interface SidebarProps {
  categories: Category[]
}

export function Sidebar({ categories }: SidebarProps) {
  const pathname = usePathname()
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-sidebar md:w-64">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold text-foreground md:block">AI工具集</span>
          </Link>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {categories.map((category) => {
            const Icon = iconMap[category.icon || ''] || Sparkles
            const isActive = pathname === `/category/${category.slug}`
            
            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                    : 'text-sidebar-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                <span className="hidden md:block">{category.name}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Submit Button */}
        <div className="border-t border-border p-3">
          <Link href="/submit">
            <Button className="w-full justify-center gap-2" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">提交站点</span>
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
