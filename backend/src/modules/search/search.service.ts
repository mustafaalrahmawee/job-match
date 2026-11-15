import type { Where } from 'chromadb'
import type { Job } from '../../generated/prisma/client.js'
import type { CvRole } from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import { AppError } from '../../shared/errors.js'
import type { CvsService } from '../cvs/cvs.service.js'
import { poolStart, type JobsService } from '../jobs/jobs.service.js'
import * as config from './search.config.js'
import { message, type SearchIndex } from './search.index.js'

export type FitList =
  | { result: 'no_cv' | 'not_embedded' }
  | { result: 'ok'; version: { id: number; createdAt: Date }; jobs: Job[] }

export function poolWhere(since: Date, role?: CvRole): Where {
  const pool: Where[] = [{ source: 'ba' }, { publishedAt: { $gte: since.getTime() / 1000 } }]
  return { $and: role ? [...pool, { role }] : pool }
}

export function ownWhere(userId: number): Where {
  return { $and: [{ source: 'own' }, { userId }] }
}

export class SearchService {
  constructor(
    private readonly cvs: CvsService,
    private readonly jobs: JobsService,
    private readonly index: SearchIndex,
  ) { }

  async list(userId: number, role?: CvRole, now = new Date()): Promise<FitList> {
    const started = performance.now()
    const version = await this.cvs.activeReady(userId)
    if (!version) {
      console.info(`job_search: list user ${userId} result no_cv`)
      return { result: 'no_cv' }
    }
    try {
      return await this.search(userId, version, role, now, started)
    } catch (error) {
      console.error(`job_search: search failed: ${message(error)}`)
      throw new AppError(502, 'unavailable')
    }
  }

  private async search(
    userId: number,
    version: { id: number; createdAt: Date },
    role: CvRole | undefined,
    now: Date,
    started: number,
  ): Promise<FitList> {
    let searchMs = 0
    let clock = performance.now()
    const stored = await this.index.cvVector(version.id)
    const { jobs: store } = await this.index.listStores()
    searchMs += performance.now() - clock
    if (!stored || stored.metadata.userId !== userId || stored.metadata.cvVersionId !== version.id) {
      if (stored) console.error(`job_search: entry cv-${version.id} does not belong to user ${userId}`)
      console.info(`job_search: list user ${userId} result not_embedded`)
      return { result: 'not_embedded' }
    }
    const since = poolStart(now)
    const where: Where = { $or: [poolWhere(since, role), ownWhere(userId)] }
    const checked = new Set<number>()
    const valid: { job: Job; similarity: number }[] = []
    let notVisible = 0
    let rounds = 0
    for (let n = config.TOP_K; ; n *= 2) {
      rounds += 1
      clock = performance.now()
      const hits = await this.index.query(store, stored.embedding, where, n)
      searchMs += performance.now() - clock
      const fresh = hits.filter((hit) => !checked.has(hit.jobId))
      for (const hit of fresh) checked.add(hit.jobId)
      const found = await this.jobs.visible(userId, fresh.map((hit) => hit.jobId))
      const shown = new Map(
        found.filter((job) => job.source !== 'ba' || job.publishedAt >= since).map((job) => [job.id, job]),
      )
      for (const hit of fresh) {
        const job = shown.get(hit.jobId)
        if (job) valid.push({ job, similarity: hit.similarity })
        else notVisible += 1
      }
      if (valid.length >= config.TOP_K || hits.length < n) break
    }
    const jobs = valid
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, config.TOP_K)
      .map((entry) => entry.job)
    if (notVisible) console.warn(`job_search: ${notVisible} hits not visible`)
    const total = Math.round(performance.now() - started)
    console.info(
      `job_search: list user ${userId} version ${version.id} role ${role ?? 'all'} hits ${jobs.length} not visible ${notVisible} rounds ${rounds} search ${Math.round(searchMs)} ms total ${total} ms ids ${jobs.map((job) => job.id).join(',')}`,
    )
    if (total > config.SLOW_LIST_MS) console.warn(`job_search: slow list ${total} ms`)
    return { result: 'ok', version, jobs }
  }
}
