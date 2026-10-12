import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHealthStore = defineStore('health', () => {
  const status = ref<'unknown' | 'ok' | 'error'>('unknown')

  async function check() {
    try {
      const response = await fetch('/api/v1/health')
      status.value = response.ok ? 'ok' : 'error'
    } catch {
      status.value = 'error'
    }
  }

  return { status, check }
})
