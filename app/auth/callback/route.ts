import { NextResponse, type NextRequest } from 'next/server'
import { getPublicRequestOrigin } from '@/lib/request-public-origin'

/** 历史 Supabase OAuth 回调路径；已不再使用。 */
export function GET(_request: NextRequest) {
  return NextResponse.redirect(new URL('/auth/login', getPublicRequestOrigin(_request)))
}
