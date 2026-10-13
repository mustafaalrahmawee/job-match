import { defineStore } from 'pinia'
import { fetchApi } from '../api'

export const useHealthStore = defineStore('health', () => {
  async function check() {
    await fetchApi('/health')
  }

  return { check }
})
