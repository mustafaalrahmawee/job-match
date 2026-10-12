import { defineStore } from 'pinia'
import { ref } from 'vue'

type User = { id: number; email: string }

const TOKEN_KEY = 'token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)

  function setToken(value: string | null) {
    token.value = value
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  }

  function clear() {
    setToken(null)
    user.value = null
  }

  async function login(email: string, password: string): Promise<string | null> {
    let response: Response
    try {
      response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      return 'Server nicht erreichbar.'
    }
    if (response.status === 401) return 'E-Mail oder Passwort ist falsch.'
    if (!response.ok) return 'Anmeldung gerade nicht möglich.'
    const body = await response.json()
    setToken(body.token)
    user.value = body.user
    return null
  }

  async function loadUser() {
    const response = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token.value}` },
    }).catch(() => null)
    if (response?.ok) user.value = await response.json()
    else if (response?.status === 401) clear()
  }

  async function logout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
    }).catch(() => undefined)
    clear()
  }

  return { token, user, login, loadUser, logout }
})
