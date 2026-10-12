import type { RequestHandler } from 'express'
import { authOf } from '../../shared/auth.middleware.js'
import { UnauthorizedError } from '../../shared/errors.js'
import { loginSchema, userSchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  login: RequestHandler = async (req, res) => {
    const body = loginSchema.parse(req.body)
    const user = await this.auth.authenticate(body.email, body.password)
    if (!user) throw new UnauthorizedError('Invalid email or password')
    const { token, expiresAt } = await this.auth.issueToken(user)
    res.json({ token, expires_at: expiresAt, user: userSchema.parse(user) })
  }

  logout: RequestHandler = async (req, res) => {
    await this.auth.revokeToken(authOf(req).token)
    res.status(204).end()
  }

  me: RequestHandler = (req, res) => {
    res.json(userSchema.parse(authOf(req).user))
  }
}
