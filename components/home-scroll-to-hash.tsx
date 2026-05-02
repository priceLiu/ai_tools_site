'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** 从其它页链到 `/#section-id` 时，Next 客户端路由需手动滚到对应区块 */
export function HomeScrollToHash() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const scrollToHash = (hash: string) => {
      const el = document.getElementById(hash)
      if (!el) return false
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return true
    }

    const run = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      const hash =
        typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
      if (!hash) return
      if (scrollToHash(hash)) return
      requestAnimationFrame(() => {
        if (scrollToHash(hash)) return
        timeoutId = window.setTimeout(() => {
          scrollToHash(hash)
          timeoutId = undefined
        }, 120)
      })
    }

    run()
    window.addEventListener('hashchange', run)
    return () => {
      window.removeEventListener('hashchange', run)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [pathname])

  return null
}
