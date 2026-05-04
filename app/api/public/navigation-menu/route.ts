import { NextResponse } from 'next/server'
import { getNavigationMenuTree } from '@/lib/navigation-menu'

export const dynamic = 'force-dynamic'

/** 客户端详情页侧栏等：与 SSR 相同的 getNavigationMenuTree（Neon 不可连时返回 []） */
export async function GET() {
  try {
    const tree = await getNavigationMenuTree()
    return NextResponse.json(tree)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
