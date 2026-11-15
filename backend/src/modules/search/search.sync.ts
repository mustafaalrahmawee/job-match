import type { Collection, Where } from 'chromadb'
import type { Job } from '../../generated/prisma/client.js'
import type { AuthService } from '../auth/auth.service.js'
import type { CvsService } from '../cvs/cvs.service.js'
import { poolStart, type JobsService } from '../jobs/jobs.service.js'
import * as config from './search.config.js'
import { message, type Entry, type SearchIndex, type Stores } from './search.index.js'
import { ownWhere, poolWhere } from './search.service.js'

type Tally = { embedded: number; failed: number; removed: number; hidden: number; written: string[] }

const STORE_NAME = new RegExp(`^(?:${config.CV_STORE}|${config.JOB_STORE})(\\d+)$`, 'u')

export class SearchSync {
  constructor(
    private readonly auth: AuthService,
    private readonly cvs: CvsService,
    private readonly jobs: JobsService,
    private readonly index: SearchIndex,
  ) { }

  async run(now = new Date()): Promise<boolean> {
    const tally: Tally = { embedded: 0, failed: 0, removed: 0, hidden: 0, written: [] }
    const since = poolStart(now)
    try {
      const stores = await this.index.stores()
      const accounts = await this.auth.userIds()
      const pool = await this.pool(stores, now, tally)
      for (const userId of accounts) {
        await this.own(stores, userId, now, tally)
        await this.versions(stores, userId, tally)
      }
      await this.orphans(stores, accounts, tally)
      console.info(`job_search: embedded ${tally.embedded}, not embedded ${tally.failed}`)
      console.info(`job_search: removed ${tally.removed}`)
      const entries = await this.poolEntries(stores.jobs, since)
      if (entries !== pool) console.warn(`job_search: ${pool} visible pool jobs, ${entries} pool entries`)
      console.info(`job_search: hidden text in ${tally.hidden} jobs`)
      const sample = tally.written.slice(0, config.SYNC_CHECK_ENTRIES)
      const failed = await this.unfound(stores.jobs, sample, since)
      for (const id of failed) console.error(`job_search: check failed for ${id}`)
      if (!failed.length) console.info(`job_search: check passed for ${sample.length} entries`)
      const switchOk = await this.switchChecks(stores, accounts, pool, since)
      if (failed.length || !switchOk) return false
      await this.dropOldStores()
      return true
    } catch (error) {
      console.error(`job_search: sync failed: ${message(error)}`)
      return false
    }
  }

  private async pool(stores: Stores, now: Date, tally: Tally): Promise<number> {
    const present = new Set(await this.index.ids(stores.jobs, { source: 'ba' }))
    const pool = await this.jobs.poolJobs(now)
    await this.fill(stores.jobs, pool, present, now, tally)
    const wanted = new Set(pool.map((job) => `job-${job.id}`))
    await this.drop(stores.jobs, [...present].filter((id) => !wanted.has(id)), tally)
    return pool.length
  }

  private async own(stores: Stores, userId: number, now: Date, tally: Tally): Promise<void> {
    const present = new Set(await this.index.ids(stores.jobs, ownWhere(userId)))
    const own = await this.jobs.ownJobs(userId)
    await this.fill(stores.jobs, own, present, now, tally)
    const wanted = new Set(own.map((job) => `job-${job.id}`))
    await this.drop(stores.jobs, [...present].filter((id) => !wanted.has(id)), tally)
  }

  private async versions(stores: Stores, userId: number, tally: Tally): Promise<void> {
    const present = new Set(await this.index.ids(stores.cvs, { userId }))
    const ready = await this.cvs.readyVersions(userId)
    const entries = ready
      .filter((version) => version.isActive && !present.has(`cv-${version.id}`))
      .flatMap((version) => {
        const entry = this.index.cvEntry(version)
        if (entry && entry !== 'empty') return [entry]
        tally.failed += 1
        return []
      })
    const { written, failed } = await this.index.write(stores.cvs, entries, true)
    tally.embedded += written.length
    tally.failed += failed
    const wanted = new Set(ready.map((version) => `cv-${version.id}`))
    await this.drop(stores.cvs, [...present].filter((id) => !wanted.has(id)), tally)
  }

  private async orphans(stores: Stores, accounts: number[], tally: Tally): Promise<void> {
    const where = (ids: number[]): { jobs: Where; cvs: Where | undefined } =>
      ids.length
        ? { jobs: { $and: [{ source: 'own' }, { userId: { $nin: ids } }] }, cvs: { userId: { $nin: ids } } }
        : { jobs: { source: 'own' }, cvs: undefined }
    const before = where(accounts)
    const jobs = await this.index.ids(stores.jobs, before.jobs)
    const cvs = await this.index.ids(stores.cvs, before.cvs)
    const after = where(await this.auth.userIds())
    const stillJobs = new Set(await this.index.ids(stores.jobs, after.jobs))
    const stillCvs = new Set(await this.index.ids(stores.cvs, after.cvs))
    await this.drop(stores.jobs, jobs.filter((id) => stillJobs.has(id)), tally)
    await this.drop(stores.cvs, cvs.filter((id) => stillCvs.has(id)), tally)
  }

  private async fill(store: Collection, jobs: Job[], present: Set<string>, now: Date, tally: Tally): Promise<void> {
    const entries: Entry[] = []
    for (const job of jobs.filter((candidate) => !present.has(`job-${candidate.id}`))) {
      const built = this.index.jobEntry(job, now)
      if (built?.hidden) tally.hidden += 1
      if (built) entries.push(built.entry)
      else tally.failed += 1
    }
    const { written, failed } = await this.index.write(store, entries, true)
    tally.embedded += written.length
    tally.failed += failed
    tally.written.push(...written.map((entry) => entry.id))
  }

  private async drop(store: Collection, ids: string[], tally: Tally): Promise<void> {
    if (!ids.length) return
    await store.delete({ ids })
    tally.removed += ids.length
  }

  private async poolEntries(store: Collection, since: Date): Promise<number> {
    return (await this.index.ids(store, poolWhere(since))).length
  }

  private async unfound(store: Collection, ids: string[], since: Date): Promise<string[]> {
    if (!ids.length) return []
    const found = await store.get<{ source: string; userId?: number }>({ ids, include: ['embeddings', 'metadatas'] })
    const failed = ids.filter((id) => !found.ids.includes(id))
    for (const [index, id] of found.ids.entries()) {
      const metadata = found.metadatas[index]!
      const where = metadata.source === 'own' && metadata.userId ? ownWhere(metadata.userId) : poolWhere(since)
      const hits = await this.index.query(store, found.embeddings[index], where, config.TOP_K)
      const best = hits[0]?.similarity ?? 0
      if (!hits.some((hit) => hit.id === id && best - hit.similarity < 1e-6)) failed.push(id)
    }
    return failed
  }

  private async switchChecks(stores: Stores, accounts: number[], pool: number, since: Date): Promise<boolean> {
    const generation = this.index.settings.storeGeneration
    if (this.index.settings.listGeneration >= generation) return true
    const read = await this.index.listStores()
    const failed: string[] = []
    let numbers = (await this.poolEntries(stores.jobs, since)) === pool
    let versions = true
    for (const userId of accounts) {
      const own = await this.jobs.ownJobs(userId)
      const entries = await this.index.ids(stores.jobs, ownWhere(userId))
      if (own.length !== entries.length) numbers = false
      const active = await this.cvs.activeReady(userId)
      if (!active) continue
      const id = `cv-${active.id}`
      const before = await read.cvs.get({ ids: [id], include: [] })
      const after = await stores.cvs.get({ ids: [id], include: [] })
      if (before.ids.length && !after.ids.length) versions = false
    }
    if (!numbers) failed.push('numbers')
    if (!versions) failed.push('versions')
    const first = await stores.jobs.get({ limit: config.SWITCH_CHECK_ENTRIES, include: [] })
    if ((await this.unfound(stores.jobs, first.ids, since)).length) failed.push('search')
    for (const name of failed) console.error(`job_search: generation ${generation} check failed: ${name}`)
    if (!failed.length) console.info(`job_search: generation ${generation} checks passed`)
    return !failed.length
  }

  private async dropOldStores(): Promise<void> {
    const { storeGeneration, listGeneration } = this.index.settings
    const dropped = new Set<number>()
    for (const name of await this.index.collectionNames()) {
      const generation = Number(STORE_NAME.exec(name)?.[1] ?? NaN)
      if (!(generation < storeGeneration) || generation === listGeneration) continue
      await this.index.dropStore(name)
      dropped.add(generation)
    }
    for (const generation of dropped) console.info(`job_search: removed stores of generation ${generation}`)
  }
}
