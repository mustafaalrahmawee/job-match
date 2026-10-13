import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAuthStore } from '../src/stores/auth'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => vi.unstubAllGlobals())

test('logout sends the token and forgets it', async () => {
  localStorage.setItem('token', 'abc')
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const auth = useAuthStore()

  await auth.logout()

  expect(fetch).toHaveBeenCalledWith('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: 'Bearer abc' },
  })
  expect(auth.token).toBeNull()
  expect(localStorage.getItem('token')).toBeNull()
})

test('an expired token is dropped when loading the user', async () => {
  localStorage.setItem('token', 'old')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  const auth = useAuthStore()

  await expect(auth.loadUser()).rejects.toMatchObject({ status: 401 })

  expect(auth.token).toBeNull()
})
