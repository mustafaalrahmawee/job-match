import type { Request, RequestHandler } from 'express'
import type { AuthToken, User } from '../generated/prisma/client.js'
import { UnauthorizedError } from './errors.js'

export type AuthContext = { token: AuthToken; user: User }

export type TokenFinder = {
  findValidToken(token: string): Promise<(AuthToken & { user: User }) | null>
}

export function requireAuth(tokens: TokenFinder): RequestHandler {
  return async (req, _res, next) => {
    const [scheme, credentials] = (req.get('authorization') ?? '').split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !credentials) {
      throw new UnauthorizedError('Not authenticated')
    }
    const token = await tokens.findValidToken(credentials)
    if (!token) throw new UnauthorizedError('Invalid or expired token')
    req.auth = { token, user: token.user }
    next()
  }
}

export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new UnauthorizedError()
  return req.auth
}
