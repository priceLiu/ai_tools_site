'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AdminFeaturedToggleProps {
  toolId: string
  initialFeatured: boolean
}

/** 将已通过工具在首页「热门工具」区展示（对应 tools.is_featured） */
export function AdminFeaturedToggle({
  toolId,
  initialFeatured,
}: AdminFeaturedToggleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [featured, setFeatured] = useState(initialFeatured)

  const toggle = async () => {
    const next = !featured
    setFeatured(next)
    const supabase = createClient()
    const { error } = await supabase
      .from('tools')
      .update({
        is_featured: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', toolId)

    if (error) {
      setFeatured(!next)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">首页热门</span>
      <Button
        type="button"
        size="sm"
        variant={featured ? 'default' : 'outline'}
        className="h-8 gap-1"
        onClick={() => void toggle()}
        disabled={isPending}
      >
        {isPending ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <Star
            className={`h-3.5 w-3.5 ${featured ? 'fill-current' : ''}`}
          />
        )}
        {featured ? '已设为热门' : '设为热门'}
      </Button>
    </div>
  )
}
