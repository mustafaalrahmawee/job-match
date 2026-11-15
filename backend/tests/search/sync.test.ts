import { ChromaClient } from 'chromadb'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Job } from '../../src/generated/prisma/client.js'
import { CvsService } from '../../src/modules/cvs/cvs.service.js'
import { poolStart, JobsService } from '../../src/modules/jobs/jobs.service.js'
import * as config from '../../src/modules/search/search.config.js'
import type { SearchIndex } from '../../src/modules/search/search.index.js'
import { SearchSync } from '../../src/modules/search/search.sync.js'
import {
  createAnna,
  createJob,
  createVersion,
  dayStart,
  dropStores,
  fakeEmbed,
  storeVector,
  testIndex,
  unitVector,
  useTestDatabase,
  vectorOf,
} from '../helpers.js'

const { auth, prisma, chroma, embedder, searchIndex, messages, ba } = useTestDatabase()
let annaId: number
let logs: string[]

beforeEach(async () => {
  annaId = (await createAnna(auth)).id
  logs = []
  for (const level of ['info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function syncWith(index: SearchIndex) {
  const cvs = new CvsService(prisma, messages.send, index)
  const jobs = new JobsService(prisma, ba.client, messages.send, index)
  return { sync: new SearchSync(auth, cvs, jobs, index), cvs, jobs }
}

function run(index = searchIndex) {
  return syncWith(index).sync.run()
}

function metadata(job: Job): Record<string, string | number> {
  return {
    jobId: job.id,
    source: job.source,
    ...(job.userId === null ? {} : { userId: job.userId }),
    role: job.role,
    publishedAt: dayStart(job.publishedAt),
  }
}

async function ids(index = searchIndex): Promise<{ cvs: string[]; jobs: string[] }> {
  const { cvs, jobs } = await index.stores()
  return { cvs: (await index.ids(cvs)).sort(), jobs: (await index.ids(jobs)).sort() }
}

test('a visible pool job without an entry is embedded, with progress and closing lines', async () => {
  const job = await createJob(prisma)

  expect(await run()).toBe(true)

  expect((await ids()).jobs).toEqual([`job-${job.id}`])
  expect(logs).toContain('job_search: embedded 1 of 1')
  expect(logs).toContain('job_search: embedded 1, not embedded 0')
  expect(logs).toContain('job_search: removed 0')
  expect(logs).toContain('job_search: check passed for 1 entries')
})

test('the entry of a pool job before the window is removed', async () => {
  const old = await createJob(prisma, { publishedAt: new Date(poolStart(new Date()).getTime() - 86_400_000) })
  await storeVector(searchIndex, `job-${old.id}`, unitVector(0), metadata(old))

  await run()

  expect((await ids()).jobs).toEqual([])
  expect(logs).toContain('job_search: removed 1')
})

test('entries of a deleted own job and a deleted version are removed', async () => {
  await storeVector(searchIndex, 'job-999001', unitVector(0), {
    jobId: 999001,
    source: 'own',
    userId: annaId,
    role: 'Andere',
    publishedAt: dayStart(new Date()),
  })
  await storeVector(searchIndex, 'cv-999002', unitVector(0), { cvVersionId: 999002, userId: annaId })

  await run()

  expect(await ids()).toEqual({ cvs: [], jobs: [] })
})

test('every read of own jobs and versions carries the userId of one account, pool jobs are read without', async () => {
  const bob = await auth.createUser('bob@example.com', 'auch-geheim')
  for (const userId of [annaId, bob.id]) {
    await createJob(prisma, { source: 'own', userId, role: 'Andere' })
    await createVersion(prisma, userId)
  }
  const { sync, cvs, jobs } = syncWith(searchIndex)
  const own = vi.spyOn(jobs, 'ownJobs')
  const versions = vi.spyOn(cvs, 'readyVersions')
  const pool = vi.spyOn(jobs, 'poolJobs')
  const reads = vi.spyOn(searchIndex, 'ids')

  await sync.run()

  expect(own.mock.calls.map(([userId]) => userId).sort()).toEqual([annaId, bob.id].sort())
  expect(versions.mock.calls.map(([userId]) => userId).sort()).toEqual([annaId, bob.id].sort())
  expect(pool).toHaveBeenCalledTimes(1)
  const { cvs: cvStore } = await searchIndex.stores()
  for (const [store, where] of reads.mock.calls) {
    const text = JSON.stringify(where ?? {})
    if (store.name === cvStore.name || text.includes('"own"')) expect(text).toMatch(/"userId"/u)
    else expect(text).toContain('"ba"')
  }
})

test('entries whose userId belongs to no account are removed', async () => {
  await storeVector(searchIndex, 'job-999003', unitVector(0), {
    jobId: 999003,
    source: 'own',
    userId: 999,
    role: 'Andere',
    publishedAt: dayStart(new Date()),
  })
  await storeVector(searchIndex, 'cv-999004', unitVector(0), { cvVersionId: 999004, userId: 999 })

  await run()

  expect(await ids()).toEqual({ cvs: [], jobs: [] })
})

test('an account created during the sync keeps its entries', async () => {
  const bob = await auth.createUser('bob@example.com', 'auch-geheim')
  const job = await createJob(prisma, { source: 'own', userId: bob.id, role: 'Andere' })
  await storeVector(searchIndex, `job-${job.id}`, unitVector(0), metadata(job))
  vi.spyOn(auth, 'userIds').mockResolvedValueOnce([annaId]).mockResolvedValueOnce([annaId, bob.id])

  await run()

  expect((await ids()).jobs).toEqual([`job-${job.id}`])
})

test('inactive ready versions keep their entry but get none, the active one is embedded', async () => {
  const kept = await createVersion(prisma, annaId, { isActive: false })
  const without = await createVersion(prisma, annaId, { isActive: false })
  const active = await createVersion(prisma, annaId)
  await storeVector(searchIndex, `cv-${kept.id}`, unitVector(0), { cvVersionId: kept.id, userId: annaId })

  await run()

  expect((await ids()).cvs).toEqual([`cv-${active.id}`, `cv-${kept.id}`].sort())
  expect((await ids()).cvs).not.toContain(`cv-${without.id}`)
})

test('a second sync without changes embeds and removes nothing', async () => {
  await createJob(prisma)
  await createVersion(prisma, annaId)
  await run()
  embedder.calls.length = 0
  logs.length = 0

  await run()

  expect(embedder.calls).toEqual([])
  expect(logs).toContain('job_search: removed 0')
  expect(logs).toContain('job_search: check passed for 0 entries')
})

test('hidden text is counted per sync, and only for jobs embedded in it', async () => {
  await createJob(prisma, { description: 'a <div hidden>x</div>' })
  await createJob(prisma, { description: 'b \u{E0041}' })
  await createJob(prisma, { description: 'c' })

  await run()
  expect(logs).toContain('job_search: hidden text in 2 jobs')

  logs.length = 0
  await run()
  expect(logs).toContain('job_search: hidden text in 0 jobs')
  expect(logs.some((line) => line.includes('hidden text:'))).toBe(false)
})

test('a job with invalid metadata is left out, the others are written', async () => {
  const bad = await createJob(prisma, { userId: annaId })
  const good = await createJob(prisma)

  await run()

  expect(logs).toContain(`job_search: job-${bad.id} not embedded: invalid metadata: userId`)
  expect((await ids()).jobs).toEqual([`job-${good.id}`])
  expect(logs).toContain('job_search: embedded 1, not embedded 1')
  expect(logs).toContain('job_search: 2 visible pool jobs, 1 pool entries')
})

test('three new jobs pass the search check', async () => {
  for (const n of [1, 2, 3]) await createJob(prisma, { title: `Stelle ${n}` })
  await run()
  expect(logs).toContain('job_search: check passed for 3 entries')
})

test('a written entry the search does not find fails the check and the command', async () => {
  const job = await createJob(prisma)
  const { sync } = syncWith(searchIndex)
  vi.spyOn(searchIndex, 'query').mockResolvedValue([])

  expect(await sync.run()).toBe(false)

  expect(logs).toContain(`job_search: check failed for job-${job.id}`)
  expect((await ids()).jobs).toEqual([`job-${job.id}`])
})

test('an unreachable ChromaDB stops the sync with an error and removes nothing', async () => {
  const down = testIndex(new ChromaClient({ host: '127.0.0.1', port: 9, ssl: false }), fakeEmbed().embed)
  const old = await createJob(prisma, { publishedAt: new Date(poolStart(new Date()).getTime() - 86_400_000) })
  await storeVector(searchIndex, `job-${old.id}`, unitVector(0), metadata(old))

  expect(await run(down)).toBe(false)

  expect(logs.some((line) => line.startsWith('job_search: sync failed'))).toBe(true)
  expect((await ids()).jobs).toEqual([`job-${old.id}`])
})

test('a new write generation is filled while the read generation stays, until the switch', async () => {
  const job = await createJob(prisma)
  await createVersion(prisma, annaId)
  await run()
  const next = testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 1 })

  expect(await run(next)).toBe(true)

  expect((await ids(next)).jobs).toEqual([`job-${job.id}`])
  expect(await next.collectionNames()).toEqual(
    expect.arrayContaining([`${config.CV_STORE}1`, `${config.JOB_STORE}1`]),
  )
  expect(logs).toContain('job_search: generation 2 checks passed')

  await run(testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 2 }))
  const names = await next.collectionNames()
  expect(names.sort()).toEqual([`${config.CV_STORE}2`, `${config.JOB_STORE}2`])
  expect(logs).toContain('job_search: removed stores of generation 1')
})

test('a failed generation in between is removed, the read one stays, nothing is carried over', async () => {
  const job = await createJob(prisma)
  const version = await createVersion(prisma, annaId)
  for (const generation of [1, 2]) {
    await storeVector(testIndex(chroma, embedder.embed, { storeGeneration: generation, listGeneration: generation }), `job-${job.id}`, unitVector(0), metadata(job))
  }
  const third = testIndex(chroma, embedder.embed, { storeGeneration: 3, listGeneration: 1 })
  embedder.calls.length = 0

  await run(third)

  expect((await third.collectionNames()).sort()).toEqual(
    [`${config.CV_STORE}1`, `${config.JOB_STORE}1`, `${config.CV_STORE}3`, `${config.JOB_STORE}3`].sort(),
  )
  expect(await ids(third)).toEqual({ cvs: [`cv-${version.id}`], jobs: [`job-${job.id}`] })
  expect(embedder.calls.flat()).toHaveLength(2)
})

test('smaller dimensions are embedded anew, the inactive version gets no entry and nothing is cut', async () => {
  const job = await createJob(prisma)
  const active = await createVersion(prisma, annaId)
  const inactive = await createVersion(prisma, annaId, { isActive: false })
  await dropStores(chroma)
  const first = testIndex(chroma, embedder.embed, { dimensions: 8 })
  await storeVector(first, `cv-${inactive.id}`, vectorOf('x', 8), { cvVersionId: inactive.id, userId: annaId })
  const small = fakeEmbed(4)
  const second = testIndex(chroma, small.embed, { storeGeneration: 2, listGeneration: 1, dimensions: 4 })

  await run(second)

  const { cvs, jobs } = await second.stores()
  const stored = await jobs.get({ include: ['embeddings'] })
  expect(stored.ids).toEqual([`job-${job.id}`])
  expect(stored.embeddings[0]).toHaveLength(4)
  expect((await cvs.get({})).ids).toEqual([`cv-${active.id}`])
  expect(small.calls.flat()).toHaveLength(2)
  expect(logs.join('\n')).not.toMatch(/truncated/u)
  expect((await first.collectionNames()).sort()).toContain(`${config.CV_STORE}1`)
})

test('removing in the sync touches only the write generation', async () => {
  const entry = { jobId: 999005, source: 'own', userId: annaId, role: 'Andere', publishedAt: dayStart(new Date()) }
  const first = testIndex(chroma, embedder.embed)
  const second = testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 1 })
  await storeVector(first, 'job-999005', unitVector(0), entry)
  await storeVector(second, 'job-999005', unitVector(0), entry)

  await run(second)

  expect((await ids(second)).jobs).toEqual([])
  expect((await ids(first)).jobs).toEqual(['job-999005'])
})

test('the switch checks fail on a missing version and on missing pool jobs', async () => {
  await createJob(prisma, { title: 'Stelle fehlt' })
  const version = await createVersion(prisma, annaId)
  const first = testIndex(chroma, embedder.embed)
  await storeVector(first, `cv-${version.id}`, unitVector(0), { cvVersionId: version.id, userId: annaId })
  await first.stores()
  embedder.answer(() => Promise.reject(new Error('ollama 500: down')))

  expect(await run(testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 1 }))).toBe(false)

  expect(logs).toContain('job_search: generation 2 check failed: versions')
  expect(logs).toContain('job_search: generation 2 check failed: numbers')
  expect(await first.collectionNames()).toContain(`${config.CV_STORE}1`)
})

test('a failed check removes no older store', async () => {
  await createJob(prisma, { title: 'Stelle fehlt' })
  const second = testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 2 })
  await second.stores()
  embedder.answer(() => Promise.reject(new Error('ollama 500: down')))

  expect(await run(testIndex(chroma, embedder.embed, { storeGeneration: 3, listGeneration: 1 }))).toBe(false)

  expect(logs).toContain('job_search: generation 3 check failed: numbers')
  expect(await second.collectionNames()).toEqual(expect.arrayContaining([`${config.CV_STORE}2`, `${config.JOB_STORE}2`]))
  expect(logs.some((line) => line.startsWith('job_search: removed stores'))).toBe(false)
})

test('without a new generation there is no switch check', async () => {
  await createJob(prisma)
  await run()
  expect(logs.some((line) => line.includes('generation'))).toBe(false)
})
