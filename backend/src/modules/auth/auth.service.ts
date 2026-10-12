import type { AuthToken, PrismaClient, User } from '../../generated/prisma/client.js'
import {
  dummyHash,
  hashPassword,
  hashToken,
  newToken,
  normalizeEmail,
  verifyPassword,
} from './auth.security.js'

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenTtlDays: number,
  ) {}

  getUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } })
  }

  async createUser(email: string, password: string): Promise<User> {
    return this.prisma.user.create({
      data: { email: normalizeEmail(email), passwordHash: await hashPassword(password) },
    })
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email)
    const valid = await verifyPassword(user?.passwordHash ?? dummyHash, password)
    return valid ? user : null
  }

  async issueToken(user: User): Promise<{ token: string; expiresAt: Date }> {
    const { token, expiresAt } = newToken(this.tokenTtlDays)
    await this.prisma.authToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    })
    return { token, expiresAt }
  }

  findValidToken(token: string): Promise<(AuthToken & { user: User }) | null> {
    return this.prisma.authToken.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      include: { user: true },
    })
  }

  async revokeToken(token: AuthToken): Promise<void> {
    await this.prisma.authToken.delete({ where: { id: token.id } })
  }
}
