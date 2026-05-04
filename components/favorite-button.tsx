'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { toggleFavoriteAction } from '@/app/actions/database-mutations'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  toolId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  /** 用于详情页等与 tools.favorite_count 同步的乐观更新（数据库由触发器维护） */
  onFavoriteCountDelta?: (delta: number) => void
}

export function FavoriteButton({
  toolId,
  initialFavorited,
  isLoggedIn,
  onFavoriteCountDelta,
}: FavoriteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)

  /**
   * 父组件（如详情页）首次挂载时通常拿不到 favorited 状态，要等 `/api/account/favorite-status`
   * 异步返回后才 setState。这里同步 prop → state，让 Heart 颜色跟得上真实值。
   */
  useEffect(() => {
    setIsFavorited(initialFavorited)
  }, [initialFavorited, toolId])

  const handleToggleFavorite = async () => {
    if (!isLoggedIn) {
      router.push('/auth/login')
      return
    }

    const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
    const sessionJson = sessionRes.ok
      ? ((await sessionRes.json()) as { user?: { id: string } | null })
      : { user: null }

    if (!sessionJson.user) {
      router.push('/auth/login')
      return
    }

    if (isFavorited) {
      const { error } = await toggleFavoriteAction(toolId, true)
      if (!error) {
        setIsFavorited(false)
        onFavoriteCountDelta?.(-1)
      }
    } else {
      const { error } = await toggleFavoriteAction(toolId, false)
      if (!error) {
        setIsFavorited(true)
        onFavoriteCountDelta?.(1)
      }
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggleFavorite}
      disabled={isPending}
      className={cn(
        'transition-colors',
        isFavorited && 'text-red-500 hover:text-red-600',
      )}
    >
      <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
    </Button>
  )
}
