'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** 从其它页链到 `/#section-id` 时，Next 客户端路由需手动滚到对应区块 */
export function HomeScrollToHash() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    const run = () => {
      const hash =
        typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
      if (!hash) return
      const el = document.getElementById(hash)
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }

    run()
    window.addEventListener('hashchange', run)
    return () => window.removeEventListener('hashchange', run)
  }, [pathname])

  return null
}
