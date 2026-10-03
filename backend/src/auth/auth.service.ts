import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import type { AuthResponse, LoginRequest, User } from '@job-match/shared';
import { and, eq, gt } from 'drizzle-orm';

import type { Db } from '../db';
import { AppError } from '../errors';
import { authTokens, users } from './auth.tables';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'invalid_credentials', 'E-Mail oder Passwort ist falsch.');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'unauthorized', 'Bitte melde dich an.');
  }
}

function scryptKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptKey(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = await scryptKey(password, salt);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const userColumns = { id: users.id, email: users.email };

export async function setPassword(db: Db, email: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash } })
    .returning(userColumns);
  if (!user) throw new Error('Nutzer wurde nicht gespeichert.');
  return user;
}

export async function login(db: Db, input: LoginRequest): Promise<AuthResponse> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(authTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: user.id, email: user.email },
  };
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.delete(authTokens).where(eq(authTokens.tokenHash, hashToken(token)));
}

export async function authenticate(db: Db, token: string): Promise<User> {
  const [user] = await db
    .select(userColumns)
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(and(eq(authTokens.tokenHash, hashToken(token)), gt(authTokens.expiresAt, new Date())));
  if (!user) throw new UnauthorizedError();
  return user;
}
