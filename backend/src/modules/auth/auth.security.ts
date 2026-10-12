import { createHash, randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export const dummyHash = await argon2.hash('dummy-password')

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken(ttlDays: number): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  return { token: randomBytes(32).toString('base64url'), expiresAt }
}
