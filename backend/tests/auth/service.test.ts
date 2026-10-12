import { expect, test } from 'vitest'
import { createAnna, useTestDatabase } from '../helpers.js'

const { auth } = useTestDatabase()

test('createUser normalizes the email', async () => {
  const user = await auth.createUser('  Ben@Example.COM ', 'richtig-geheim')
  expect(user.email).toBe('ben@example.com')
})

test('authenticate returns the user only for the right password', async () => {
  await createAnna(auth)
  expect(await auth.authenticate('anna@example.com', 'richtig-geheim')).not.toBeNull()
  expect(await auth.authenticate('anna@example.com', 'falsch')).toBeNull()
  expect(await auth.authenticate('niemand@example.com', 'richtig-geheim')).toBeNull()
})

test('issued token is found until revoked', async () => {
  const user = await createAnna(auth)
  const { token } = await auth.issueToken(user)
  const stored = await auth.findValidToken(token)
  expect(stored?.userId).toBe(user.id)

  await auth.revokeToken(stored!)
  expect(await auth.findValidToken(token)).toBeNull()
})
