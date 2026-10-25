import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchApi } from '../api'
import type { Interview, InterviewDifficulty } from '../types'

export const useInterviewsStore = defineStore('interviews', () => {
  const list = ref<Interview[]>([])
  const current = ref<Interview | null>(null)

  async function loadList() {
    const response = await fetchApi('/interviews')
    list.value = (await response.json()) as Interview[]
  }

  async function load(id: number) {
    current.value = null
    const response = await fetchApi(`/interviews/${id}`)
    current.value = (await response.json()) as Interview
  }

  async function start(jobId: number, difficulty: InterviewDifficulty): Promise<Interview> {
    const response = await fetchApi('/interviews', { method: 'POST', body: { job_id: jobId, difficulty } })
    current.value = (await response.json()) as Interview
    return current.value
  }

  async function step(id: number, action: 'answer' | 'skip' | 'continue', body?: { answer: string }) {
    try {
      const response = await fetchApi(`/interviews/${id}/${action}`, { method: 'POST', body })
      current.value = (await response.json()) as Interview
    } catch (error) {
      const response = await fetchApi(`/interviews/${id}`)
      current.value = (await response.json()) as Interview
      throw error
    }
  }

  return { list, current, loadList, load, start, step }
})
