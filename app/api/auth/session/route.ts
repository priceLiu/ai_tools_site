import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAuthUser({ allowRedirectOnDisabled: false })
  return NextResponse.json({ user })
}
