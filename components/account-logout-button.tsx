'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { invalidateAuthMeCache } from '@/lib/client-auth-me-cache'

export function AccountLogoutButton() {
  const handleLogout = () => {
    void (async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      invalidateAuthMeCache()
      window.location.assign('/')
    })()
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
