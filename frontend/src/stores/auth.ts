import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, fetchApi } from '../api'
import type { User } from '../types'

const TOKEN_KEY = 'token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)

  function setToken(value: string | null) {
    token.value = value
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  }

  async function login(email: string, password: string) {
    const response = await fetchApi('/auth/login', { method: 'POST', body: { email, password } })
    const body = await response.json()
    setToken(body.token)
    user.value = body.user
  }

  async function loadUser() {
    try {
      const response = await fetchApi('/auth/me')
      user.value = await response.json()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setToken(null)
        user.value = null
      }
      throw error
    }
  }

  async function logout() {
    try {
      await fetchApi('/auth/logout', { method: 'POST' })
    } finally {
      setToken(null)
      user.value = null
    }
  }

  return { token, user, login, loadUser, logout }
})
