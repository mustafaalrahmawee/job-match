import type { AuthToken, User } from '../generated/prisma/client.js'

declare global {
  namespace Express {
    interface Request {
      auth?: { token: AuthToken; user: User }
    }
  }
}

export {}
