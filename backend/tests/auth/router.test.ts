import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import type { User } from '../../src/generated/prisma/client.js'
import { createAnna, useTestDatabase } from '../helpers.js'

const { app, auth, prisma } = useTestDatabase()
let user: User

beforeEach(async () => {
  user = await createAnna(auth)
})

function login(email = 'anna@example.com', password = 'richtig-geheim') {
  return request(app).post('/api/v1/auth/login').send({ email, password })
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function loginToken(): Promise<string> {
  const response = await login()
  return (response.body as { token: string }).token
}

test('login returns a token that opens me', async () => {
  const response = await login()
  expect(response.status).toBe(200)
  const body = response.body as { token: string; expires_at: string; user: unknown }
  expect(body.user).toEqual({ id: user.id, email: 'anna@example.com' })
  expect(new Date(body.expires_at).getTime()).toBeGreaterThan(Date.now())

  const me = await request(app).get('/api/v1/auth/me').set(bearer(body.token))
  expect(me.status).toBe(200)
  expect(me.body).toEqual({ id: user.id, email: 'anna@example.com' })
})

test('email ignores case and spaces', async () => {
  const response = await login('  Anna@Example.com ')
  expect(response.status).toBe(200)
})

test('wrong password and unknown email get the same answer', async () => {
  const wrongPassword = await login(undefined, 'falsch')
  const unknownEmail = await login('niemand@example.com')
  expect(wrongPassword.status).toBe(401)
  expect(unknownEmail.status).toBe(401)
  expect(wrongPassword.body).toEqual(unknownEmail.body)
  expect(wrongPassword.body).toEqual({ detail: 'Invalid email or password' })
})

test('a body without email and password is rejected with 422', async () => {
  const response = await request(app).post('/api/v1/auth/login').send({ email: 'anna@example.com' })
  expect(response.status).toBe(422)
})

test('logout revokes the token', async () => {
  const token = await loginToken()

  const logout = await request(app).post('/api/v1/auth/logout').set(bearer(token))
  expect(logout.status).toBe(204)

  const me = await request(app).get('/api/v1/auth/me').set(bearer(token))
  expect(me.status).toBe(401)
})

test('logout keeps other sessions', async () => {
  const first = await loginToken()
  const second = await loginToken()

  await request(app).post('/api/v1/auth/logout').set(bearer(first))

  const me = await request(app).get('/api/v1/auth/me').set(bearer(second))
  expect(me.status).toBe(200)
})

test('expired token is rejected', async () => {
  const token = await loginToken()
  await prisma.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

  const me = await request(app).get('/api/v1/auth/me').set(bearer(token))
  expect(me.status).toBe(401)
})

test('missing or unknown token is rejected', async () => {
  const missing = await request(app).get('/api/v1/auth/me')
  expect(missing.status).toBe(401)
  expect(missing.get('WWW-Authenticate')).toBe('Bearer')
  expect((await request(app).get('/api/v1/auth/me').set(bearer('erfunden'))).status).toBe(401)
  expect((await request(app).post('/api/v1/auth/logout')).status).toBe(401)
})

test('token is stored only as hash', async () => {
  const token = await loginToken()
  const stored = await prisma.authToken.findFirstOrThrow()
  expect(stored.tokenHash).not.toBe(token)
  expect(stored.tokenHash).toHaveLength(64)
})
