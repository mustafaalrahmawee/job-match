import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, fetchApi } from '../api'
import type { CvRole, CvVersion, CvVersionSummary } from '../types'

export const useCvStore = defineStore('cv', () => {
  const version = ref<CvVersion | null>(null)
  const versions = ref<CvVersionSummary[]>([])

  async function loadActive() {
    try {
      const response = await fetchApi('/cvs/active')
      version.value = (await response.json()) as CvVersion
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
      version.value = null
    }
  }

  async function loadVersions() {
    const response = await fetchApi('/cvs')
    versions.value = (await response.json()) as CvVersionSummary[]
  }

  async function upload(file: File) {
    const body = new Blob([file], { type: 'application/pdf' })
    const response = await fetchApi('/cvs', { method: 'POST', body })
    version.value = (await response.json()) as CvVersion
  }

  async function activate(id: number) {
    const response = await fetchApi(`/cvs/${id}/activation`, { method: 'POST' })
    version.value = (await response.json()) as CvVersion
  }

  async function remove(id: number) {
    await fetchApi(`/cvs/${id}`, { method: 'DELETE' })
    versions.value = versions.value.filter((entry) => entry.id !== id)
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

  return { version, versions, loadActive, loadVersions, upload, activate, remove, retry, confirmRole }
})
