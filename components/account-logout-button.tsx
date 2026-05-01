'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function AccountLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      退出登录
    </Button>
  )
}
