import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../src/views/LoginView.vue'

function respond(status: number, body: unknown = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

async function submitLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/', component: { template: '<p>Start</p>' } },
    ],
  })
  await router.push('/login')
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  await wrapper.find('input[type=email]').setValue('anna@example.com')
  await wrapper.find('input[type=password]').setValue('richtig-geheim')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => vi.unstubAllGlobals())

test('wrong credentials show one message and store no token', async () => {
  respond(401, { detail: 'Invalid email or password' })
  const { wrapper, router } = await submitLogin()
  expect(wrapper.find('[role=alert]').text()).toBe('E-Mail oder Passwort ist falsch.')
  expect(localStorage.getItem('token')).toBeNull()
  expect(router.currentRoute.value.path).toBe('/login')
})

test('successful login stores the token and opens the start page', async () => {
  respond(200, { token: 'abc', expires_at: '2026-11-10T00:00:00Z', user: { id: 1, email: 'anna@example.com' } })
  const { router } = await submitLogin()
  expect(localStorage.getItem('token')).toBe('abc')
  expect(router.currentRoute.value.path).toBe('/')
})
