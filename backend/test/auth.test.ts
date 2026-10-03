import { createHash } from 'node:crypto';

import { AuthResponseSchema } from '@job-match/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { hashPassword, setPassword, verifyPassword } from '../src/auth/auth.service';
import { authTokens } from '../src/auth/auth.tables';
import { PASSWORD, TEST_DATABASE_URL, useTestDb } from './helpers';

it('password hashing accepts the right password and rejects a wrong or broken one', async () => {
  const stored = await hashPassword(PASSWORD);

  expect(stored).not.toContain(PASSWORD);
  await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(true);
  await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  await expect(verifyPassword(PASSWORD, 'kaputt')).resolves.toBe(false);
});

describe.skipIf(!TEST_DATABASE_URL)('auth', () => {
  const { db, app, newEmail, signIn } = useTestDb();
  const loginAs = (email: string, password: string) =>
    request(app).post('/api/auth/login').send({ email, password });

  it('login, me and logout work with the token', async () => {
    const email = newEmail();
    await setPassword(db, email, PASSWORD);

    const login = await loginAs(email, PASSWORD);
    const headers = { Authorization: `Bearer ${AuthResponseSchema.parse(login.body).token}` };
    const me = await request(app).get('/api/auth/me').set(headers);
    const logout = await request(app).post('/api/auth/logout').set(headers);
    const afterLogout = await request(app).get('/api/auth/me').set(headers);

    expect(login.status).toBe(200);
    expect(me.body).toMatchObject({ email });
    expect(logout.status).toBe(204);
    expect(afterLogout.status).toBe(401);
  });

  it('gives the same 401 for an unknown email and a wrong password', async () => {
    const email = newEmail();
    await setPassword(db, email, PASSWORD);

    const unknown = await loginAs(newEmail(), PASSWORD);
    const wrong = await loginAs(email, 'wrong-password');

    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('setting the password again replaces the old one', async () => {
    const email = newEmail();
    await setPassword(db, email, PASSWORD);
    await setPassword(db, email, 'another-long-password');

    expect((await loginAs(email, PASSWORD)).status).toBe(401);
    expect((await loginAs(email, 'another-long-password')).status).toBe(200);
  });

  it('rejects a missing, malformed or expired token', async () => {
    const user = await signIn();
    await db.insert(authTokens).values({
      userId: user.id,
      tokenHash: createHash('sha256').update('expired-token').digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });

    const missing = await request(app).get('/api/auth/me');
    const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Basic abc');
    const expired = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer expired-token');

    expect([missing.status, malformed.status, expired.status]).toEqual([401, 401, 401]);
  });

  it('answers 429 after too many failed logins', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt++) {
      statuses.push((await loginAs('nobody@example.com', 'wrong-password')).status);
    }

    expect(statuses.at(-1)).toBe(429);
  });
});
