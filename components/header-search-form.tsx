'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getAccountSubmissionSearchHref } from '@/lib/account-search-destination'

function SearchSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
}

function HeaderSearchFormInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const inAccount = pathname?.startsWith('/account')
    const inAdmin = pathname?.startsWith('/admin')
    if (inAccount) setSearchQuery(searchParams.get('q') ?? '')
    else if (inAdmin) setSearchQuery(searchParams.get('q') ?? '')
    else setSearchQuery('')
  }, [pathname, searchParams])

  const inAccount = pathname?.startsWith('/account')
  const inAdmin = pathname?.startsWith('/admin')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    if (inAccount) {
      router.push(getAccountSubmissionSearchHref(pathname, q))
    } else if (inAdmin) {
      router.push(`/admin?q=${encodeURIComponent(q)}`)
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const placeholder = inAccount
    ? '在我的提交里搜索名称或工具介绍…'
    : inAdmin
      ? '搜索站内工具（含审核状态）…'
      : '站内 AI 工具搜索'

  return (
    <form onSubmit={handleSearch} className="flex-1 max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border-primary/60 bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/30"
        />
      </div>
    </form>
  )
}

export function HeaderSearchForm() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <HeaderSearchFormInner />
    </Suspense>
  )
}
