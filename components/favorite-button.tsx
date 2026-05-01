'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  toolId: string
  initialFavorited: boolean
  isLoggedIn: boolean
}

export function FavoriteButton({ toolId, initialFavorited, isLoggedIn }: FavoriteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)

  const handleToggleFavorite = async () => {
    if (!isLoggedIn) {
      router.push('/auth/login')
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (isFavorited) {
      // Remove favorite
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
      
      setIsFavorited(false)
    } else {
      // Add favorite
      await supabase
        .from('favorites')
        .insert({ user_id: user.id, tool_id: toolId })
      
      setIsFavorited(true)
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
        isFavorited && 'text-red-500 hover:text-red-600'
      )}
    >
      <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
    </Button>
  )
}
