import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, fetchApi } from '../api'
import type { CvRole, CvVersion } from '../types'

export const useCvStore = defineStore('cv', () => {
  const version = ref<CvVersion | null>(null)

  async function loadActive() {
    try {
      const response = await fetchApi('/cvs/active')
      version.value = (await response.json()) as CvVersion
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
      version.value = null
    }
  }

  async function upload(file: File) {
    const body = new Blob([file], { type: 'application/pdf' })
    const response = await fetchApi('/cvs', { method: 'POST', body })
    version.value = (await response.json()) as CvVersion
  }

  async function retry() {
    if (!version.value) return
    const response = await fetchApi(`/cvs/${version.value.id}/analysis`, { method: 'POST' })
    version.value = (await response.json()) as CvVersion
  }

  async function confirmRole(role: CvRole) {
    if (!version.value) return
    const response = await fetchApi(`/cvs/${version.value.id}`, { method: 'PATCH', body: { role } })
    version.value = (await response.json()) as CvVersion
  }

  return { version, loadActive, upload, retry, confirmRole }
})
