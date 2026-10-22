import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchApi } from '../api'
import type { Application, ApplicationNote, ApplicationStatus, ApplicationSummary } from '../types'

export const useApplicationsStore = defineStore('applications', () => {
  const list = ref<ApplicationSummary[]>([])
  const application = ref<Application | null>(null)

  async function loadList() {
    const response = await fetchApi('/applications')
    list.value = (await response.json()) as ApplicationSummary[]
  }

  async function load(id: number) {
    application.value = null
    const response = await fetchApi(`/applications/${id}`)
    application.value = (await response.json()) as Application
  }

  async function create(jobId: number): Promise<Application> {
    const response = await fetchApi('/applications', { method: 'POST', body: { job_id: jobId } })
    application.value = (await response.json()) as Application
    return application.value
  }

  async function setStatus(id: number, status: ApplicationStatus) {
    const response = await fetchApi(`/applications/${id}`, { method: 'PATCH', body: { status } })
    application.value = (await response.json()) as Application
  }

  async function addNote(id: number, content: string) {
    const response = await fetchApi(`/applications/${id}/notes`, { method: 'POST', body: { content } })
    const note = (await response.json()) as ApplicationNote
    if (application.value?.id === id) application.value.notes.unshift(note)
  }

  return { list, application, loadList, load, create, setStatus, addNote }
})
