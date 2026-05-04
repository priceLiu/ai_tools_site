import { NextRequest, NextResponse } from 'next/server'
import { neonFindAuthCredentialsByEmail } from '@/lib/auth/credentials-db'
import { setSessionCookie } from '@/lib/auth/session'
import { verifyStoredPasswordHash } from '@/lib/auth/verify-stored-password'
import { neonGetProfileIsDisabled } from '@/lib/neon/data'

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

  try {
    const row = await neonFindAuthCredentialsByEmail(email)
    if (
      !row ||
      !(await verifyStoredPasswordHash(password, row.password_hash))
    ) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }
    const disabled = await neonGetProfileIsDisabled(row.user_id)
    if (disabled === true) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 })
    }
    if (disabled === null) {
      return NextResponse.json({ error: '账号数据异常' }, { status: 500 })
    }
    await setSessionCookie(row.user_id, row.email, false)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    if (raw.includes('AUTH_SECRET') || raw.includes('at least 32')) {
      return NextResponse.json(
        {
          error:
            '服务器未配置登录密钥：请在 `.env.local` 中设置 AUTH_SECRET（至少 32 位随机字符串），保存后重启 dev 服务器再试。可在终端执行：`openssl rand -base64 32` 生成。',
        },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: raw || '登录失败' }, { status: 500 })
  }
}
