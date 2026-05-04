import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import {
  neonEmailTaken,
  neonInsertAuthCredentials,
} from '@/lib/auth/credentials-db'
import {
  neonDeleteProfile,
  neonInsertProfileForNewUser,
} from '@/lib/auth/register-db'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 })
  }
  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''
  if (!email || !password) {
    return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 })
  }

  try {
    if (await neonEmailTaken(email)) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })
    }

    const userId = crypto.randomUUID()
    const hash = bcrypt.hashSync(password, 10)
    const emailLower = email.trim().toLowerCase()

    await neonInsertProfileForNewUser(userId)
    try {
      await neonInsertAuthCredentials(userId, emailLower, hash)
    } catch (e) {
      await neonDeleteProfile(userId)
      throw e
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '注册失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
