import { SignJWT, jwtVerify } from 'jose'
import { SESSION_MAX_AGE_SEC } from './constants'

function secretKey() {
  const s = process.env.AUTH_SECRET?.trim()
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET must be set and at least 32 characters')
  }
  return new TextEncoder().encode(s)
}

export async function signSessionToken(
  userId: string,
  email: string,
  isDisabled = false,
): Promise<string> {
  return new SignJWT({ email, disabled: isDisabled })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000))
    .sign(secretKey())
}

export type VerifiedSession = { id: string; email: string; disabled: boolean }

export async function verifySessionToken(
  token: string,
): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const sub = payload.sub
    const email = payload.email
    if (typeof sub !== 'string' || typeof email !== 'string') return null
    const disabled = payload.disabled === true
    return { id: sub, email, disabled }
  } catch {
    return null
  }
}
