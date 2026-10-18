import type { CvRole } from '../../prompts/cv_analysis.js'
import { baDetailsSchema, baSearchPageSchema } from './jobs.schemas.js'

const BASE_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service'
const HEADERS = { 'X-API-Key': 'jobboerse-jobsuche' }
const TIMEOUT_MS = 20000

export const BA_PAGE_SIZE = 100
export const BA_MAX_PAGES = 2
export const POOL_DAYS = 30

export const BA_SEARCH_TERMS: Record<CvRole, string[]> = {
  Frontend: ['Frontend'],
  Backend: ['Backend'],
  Fullstack: ['Fullstack'],
  Mobile: ['App-Entwickler'],
  Data: ['Data Scientist', 'Data Engineer'],
  DevOps: ['DevOps'],
  QA: ['Softwaretester', 'QA'],
  'UX/UI': ['UX'],
  'IT-Support': ['IT-Support'],
  'IT-Projektmanagement': ['IT-Projektmanager'],
  Andere: [],
}

export class BaClient {
  constructor(private readonly fetch: (url: string, init: RequestInit) => Promise<Response>) { }

  async search(term: string, page: number): Promise<unknown[]> {
    const params = new URLSearchParams({
      was: term,
      page: String(page),
      size: String(BA_PAGE_SIZE),
      veroeffentlichtseit: String(POOL_DAYS),
      sort: 'veroeffdatum',
    })
    const body = await this.get(`/pc/v6/jobs?${params.toString()}`)
    return baSearchPageSchema.parse(body).ergebnisliste
  }

  async description(referenceNumber: string): Promise<string> {
    const id = encodeURIComponent(Buffer.from(referenceNumber).toString('base64'))
    const body = await this.get(`/pc/v4/jobdetails/${id}`)
    return baDetailsSchema
      .parse(body)
      .stellenangebotsBeschreibung.replace(/^[ \t]+$/gm, '')
      .replace(/^- *\n+[ \t]*(?![-*#])(?=\S)/gm, '- ')
      .replace(/^- *$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private async get(path: string): Promise<unknown> {
    const response = await this.fetch(`${BASE_URL}${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Bundesagentur answered ${response.status} for ${path}`)
    return response.json()
  }
}
