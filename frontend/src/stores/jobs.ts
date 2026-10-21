import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { fetchApi } from '../api'
import type { Job, JobDetail, JobDraft, JobFilter, JobList, OwnJobInput } from '../types'

export const JOBS_PAGE_SIZE = 20

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<Job[]>([])
  const total = ref(0)
  const filter = reactive<JobFilter>({ q: '', role: null, region: null, workTime: null, offerType: null })
  const page = ref(1)
  const loaded = ref(false)
  const job = ref<JobDetail | null>(null)
  const ownJobs = ref<Job[]>([])
  const ownTotal = ref(0)

  async function load(target = 1, signal?: AbortSignal) {
    const params = new URLSearchParams({
      source: 'ba',
      offset: String((target - 1) * JOBS_PAGE_SIZE),
      limit: String(JOBS_PAGE_SIZE),
    })
    if (filter.q.trim()) params.set('q', filter.q.trim())
    if (filter.role) params.set('role', filter.role)
    if (filter.region) params.set('region', filter.region)
    if (filter.workTime) params.set('work_time', filter.workTime)
    if (filter.offerType) params.set('offer_type', filter.offerType)
    const response = await fetchApi(`/jobs?${params.toString()}`, { signal })
    const result = (await response.json()) as JobList
    jobs.value = result.jobs
    total.value = result.total
    page.value = target
    loaded.value = true
  }

  async function loadOwn(offset = 0) {
    const params = new URLSearchParams({ source: 'own', offset: String(offset), limit: String(JOBS_PAGE_SIZE) })
    const response = await fetchApi(`/jobs?${params.toString()}`)
    const result = (await response.json()) as JobList
    ownJobs.value = offset ? [...ownJobs.value, ...result.jobs] : result.jobs
    ownTotal.value = result.total
  }

  async function loadOne(id: number) {
    job.value = null
    const response = await fetchApi(`/jobs/${id}`)
    job.value = (await response.json()) as JobDetail
  }

  async function extract(input: string | File): Promise<JobDraft> {
    const body = typeof input === 'string' ? { text: input } : new Blob([input], { type: input.type })
    const response = await fetchApi('/jobs/extraction', { method: 'POST', body })
    return (await response.json()) as JobDraft
  }

  async function create(input: OwnJobInput): Promise<JobDetail> {
    const response = await fetchApi('/jobs', { method: 'POST', body: input })
    job.value = (await response.json()) as JobDetail
    return job.value
  }

  return { jobs, total, filter, page, loaded, job, ownJobs, ownTotal, load, loadOwn, loadOne, extract, create }
})
