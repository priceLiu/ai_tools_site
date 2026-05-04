'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Star } from 'lucide-react'
import { adminSetToolFeaturedAction } from '@/app/actions/database-mutations'

interface AdminFeaturedToggleProps {
  toolId: string
  initialFeatured: boolean
  /** toolbar：与审核列表「热门并通过」同款的黄描边小按钮，无旁白标签 */
  appearance?: 'default' | 'toolbar'
  /** 与列表/编辑区按钮高度对齐 */
  buttonSize?: 'sm' | 'default'
}

/** 将已通过工具在首页「热门工具」区展示（对应 tools.is_featured） */
export function AdminFeaturedToggle({
  toolId,
  initialFeatured,
  appearance = 'default',
  buttonSize = 'sm',
}: AdminFeaturedToggleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [featured, setFeatured] = useState(initialFeatured)

  const toggle = async () => {
    const next = !featured
    setFeatured(next)
    const { error } = await adminSetToolFeaturedAction(toolId, next)

    if (error) {
      setFeatured(!next)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const isToolbar = appearance === 'toolbar'

  return (
    <div
      className={
        isToolbar
          ? 'inline-flex'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      {!isToolbar ? (
        <span className="text-xs text-muted-foreground">首页热门</span>
      ) : null}
      <Button
        type="button"
        size={buttonSize}
        variant={isToolbar ? 'outline' : featured ? 'default' : 'outline'}
        className={
          isToolbar
            ? `${buttonSize === 'default' ? 'gap-1.5' : 'h-8 gap-1'} ${featured ? 'border-yellow-500/80 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/15 dark:text-yellow-400' : 'gap-1 text-yellow-600 hover:text-yellow-700'}`
            : 'h-8 gap-1'
        }
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
