import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchApi } from '../api'
import type { MatchOverview, MatchResult } from '../types'

export const useMatchesStore = defineStore('matches', () => {
  const current = ref<MatchResult | null>(null)
  const archived = ref<MatchResult[]>([])

  async function load(jobId: number) {
    current.value = null
    archived.value = []
    const response = await fetchApi(`/matches?job_id=${jobId}`)
    const overview = (await response.json()) as MatchOverview
    current.value = overview.current
    archived.value = overview.archived
  }

  async function run(jobId: number) {
    const response = await fetchApi('/matches', { method: 'POST', body: { job_id: jobId } })
    const result = (await response.json()) as MatchResult
    if (result.archived) await load(jobId)
    else current.value = result
  }

  return { current, archived, load, run }
})
