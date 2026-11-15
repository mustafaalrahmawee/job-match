import { ChromaClient } from 'chromadb'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createApp } from '../../src/app.js'
import type { Job } from '../../src/generated/prisma/client.js'
import { poolStart } from '../../src/modules/jobs/jobs.service.js'
import * as config from '../../src/modules/search/search.config.js'
import {
  bearerFor,
  createAnna,
  createJob,
  createVersion,
  dayStart,
  dropStores,
  fakeEmbed,
  storeVector,
  TOKEN_TTL_DAYS,
  testIndex,
  unitVector,
  useTestDatabase,
} from '../helpers.js'

const { app, auth, prisma, chroma, embedder, searchIndex, messages, model, ba } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let versionId: number
let logs: string[]

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
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

function list(query = '') {
  return request(app).get(`/api/v1/search/jobs${query}`).set(headers)
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

async function withVersion(vector = unitVector(0)): Promise<void> {
  versionId = (await createVersion(prisma, annaId)).id
  await storeVector(searchIndex, `cv-${versionId}`, vector, { cvVersionId: versionId, userId: annaId })
}

async function put(job: Job, angle: number): Promise<Job> {
  await storeVector(searchIndex, `job-${job.id}`, unitVector(angle), metadata(job))
  return job
}

async function ranked(count: number, data: Parameters<typeof createJob>[1] = {}): Promise<Job[]> {
  const jobs: Job[] = []
  for (let place = 1; place <= count; place++) {
    jobs.push(await put(await createJob(prisma, { title: `Platz ${place}`, ...data }), place * 0.001))
  }
  return jobs
}

async function rankedMany(count: number): Promise<Job[]> {
  const today = new Date(new Date().toISOString().slice(0, 10))
  const jobs = await prisma.job.createManyAndReturn({
    data: Array.from({ length: count }, (_, index) => ({
      source: 'ba' as const,
      externalId: `ext-${index}`,
      title: `Platz ${index + 1}`,
      city: 'Kiel',
      description: 'Text',
      offerType: 'work' as const,
      role: 'Backend',
      fullTime: true,
      partTime: false,
      publishedAt: today,
    })),
  })
  const sorted = jobs.sort((a, b) => a.id - b.id)
  const { jobs: store } = await searchIndex.stores()
  for (let start = 0; start < sorted.length; start += 200) {
    const part = sorted.slice(start, start + 200)
    await store.upsert({
      ids: part.map((job) => `job-${job.id}`),
      embeddings: part.map((_, index) => unitVector((start + index + 1) * 0.001)),
      metadatas: part.map(metadata),
    })
  }
  return sorted
}

function titles(body: unknown): string[] {
  return (body as { jobs: { title: string }[] }).jobs.map((job) => job.title)
}

function places(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `Platz ${from + index}`)
}

function listLine(): string {
  return logs.find((line) => line.startsWith('job_search: list user'))!
}

test('without a ready active version the list is 409 no_cv and ChromaDB is not called', async () => {
  await createVersion(prisma, annaId, { analysisStatus: 'failed', analysis: undefined })
  const vector = vi.spyOn(searchIndex, 'cvVector')
  const stores = vi.spyOn(searchIndex, 'listStores')

  const response = await list()

  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'no_cv' })
  expect(vector).not.toHaveBeenCalled()
  expect(stores).not.toHaveBeenCalled()
  expect(logs).toContain(`job_search: list user ${annaId} result no_cv`)
})

test('a version without an entry is 409 not_embedded', async () => {
  await createVersion(prisma, annaId)
  const response = await list()
  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'not_embedded' })
  expect(logs).toContain(`job_search: list user ${annaId} result not_embedded`)
})

test('an entry cv-<id> of another user is not_embedded and logged as an error', async () => {
  const bob = await auth.createUser('bob@example.com', 'auch-geheim')
  versionId = (await createVersion(prisma, annaId)).id
  await storeVector(searchIndex, `cv-${versionId}`, unitVector(0), { cvVersionId: versionId, userId: bob.id })

  expect((await list()).body).toEqual({ detail: 'not_embedded' })
  expect(logs).toContain(`job_search: entry cv-${versionId} does not belong to user ${annaId}`)
})

test('the list has at most 20 jobs in the order of the search with the fields of the job list', async () => {
  await withVersion()
  const jobs = await ranked(25)
  const own = await put(await createJob(prisma, { source: 'own', userId: annaId, role: 'Andere', title: 'Eigen' }), 0.0105)

  const response = await list()
  const body = response.body as { cv_version: unknown; jobs: unknown[] }

  expect(response.status).toBe(200)
  expect(body.cv_version).toEqual({ id: versionId, created_at: expect.any(String) as string })
  expect(titles(body)).toEqual([...places(1, 10), 'Eigen', ...places(11, 19)])
  expect(body.jobs[0]).toEqual({
    id: jobs[0].id,
    source: 'ba',
    title: 'Platz 1',
    company: 'Werkbank GmbH',
    city: 'Kiel',
    region: null,
    offer_type: 'work',
    role: 'Backend',
    full_time: true,
    part_time: false,
    published_at: jobs[0].publishedAt.toISOString().slice(0, 10),
  })
  expect(body.jobs[10]).toMatchObject({ id: own.id, source: 'own', role: null })
  expect(JSON.stringify(response.body)).not.toMatch(/similarity|description|vote/u)
})

test('with 5 jobs in the filter the list has 5', async () => {
  await withVersion()
  await ranked(5)
  expect(titles((await list()).body)).toEqual(places(1, 5))
})

test('the most similar own job of another account never appears, the list is still full', async () => {
  const bob = await auth.createUser('bob@example.com', 'auch-geheim')
  await withVersion()
  await put(await createJob(prisma, { source: 'own', userId: bob.id, role: 'Andere', title: 'Bob' }), 0)
  await ranked(25)

  expect(titles((await list()).body)).toEqual(places(1, 20))
})

test('no version is ever a hit, even with the same vector', async () => {
  await withVersion()
  const other = await createVersion(prisma, annaId, { isActive: false })
  await storeVector(searchIndex, `cv-${other.id}`, unitVector(0), { cvVersionId: other.id, userId: annaId })
  await ranked(2)
  expect(titles((await list()).body)).toEqual(places(1, 2))
})

test('a pool job one day before the window does not appear, one at its start does', async () => {
  await withVersion()
  const start = poolStart(new Date())
  await put(await createJob(prisma, { title: 'Davor', publishedAt: new Date(start.getTime() - 86_400_000) }), 0.001)
  await put(await createJob(prisma, { title: 'Beginn', publishedAt: start }), 0.002)
  await put(
    await createJob(prisma, {
      source: 'own',
      userId: annaId,
      role: 'Andere',
      title: 'Eigen alt',
      publishedAt: new Date(start.getTime() - 86_400_000 * 10),
    }),
    0.003,
  )
  expect(titles((await list()).body)).toEqual(['Beginn', 'Eigen alt'])
})

test('a chosen role narrows only the pool, own jobs appear with every role', async () => {
  await withVersion()
  await put(await createJob(prisma, { title: 'Backend', role: 'Backend' }), 0.001)
  await put(await createJob(prisma, { title: 'Frontend', role: 'Frontend' }), 0.002)
  await put(await createJob(prisma, { title: 'Eigen', source: 'own', userId: annaId, role: 'Andere' }), 0.003)

  expect(titles((await list('?role=Backend')).body)).toEqual(['Backend', 'Eigen'])
  expect(titles((await list()).body)).toEqual(['Backend', 'Frontend', 'Eigen'])
})

test('a role outside the list is 422', async () => {
  expect((await list('?role=Koch')).status).toBe(422)
})

test('the order follows the cosine of the vectors, also when the database returns jobs in another order', async () => {
  await withVersion()
  const late = await createJob(prisma, { title: 'Entgegen' })
  const mid = await createJob(prisma, { title: 'Mitte' })
  const near = await createJob(prisma, { title: 'Nah' })
  await put(late, Math.PI)
  await put(mid, Math.PI / 3)
  await put(near, Math.PI / 6)

  expect(titles((await list()).body)).toEqual(['Nah', 'Mitte', 'Entgegen'])
  const { jobs } = await searchIndex.listStores()
  const hits = await searchIndex.query(jobs, unitVector(0), { source: 'ba' }, 3)
  expect(hits.map((hit) => hit.similarity)).toEqual([
    expect.closeTo(Math.cos(Math.PI / 6), 5),
    expect.closeTo(Math.cos(Math.PI / 3), 5),
    expect.closeTo(-1, 5),
  ])
})

test('the vector decides, not shared words', async () => {
  await withVersion()
  await put(await createJob(prisma, { title: 'Wörter', description: 'TypeScript Node.js PostgreSQL' }), 0.5)
  await put(await createJob(prisma, { title: 'Vektor', description: 'Gärtnerei' }), 0.1)
  expect(titles((await list()).body)).toEqual(['Vektor', 'Wörter'])
})

test('equal jobs and equal vectors all appear; newer or own jobs get no bonus', async () => {
  await withVersion()
  const today = new Date(new Date().toISOString().slice(0, 10))
  await put(await createJob(prisma, { title: 'Gleich' }), 0.001)
  await put(await createJob(prisma, { title: 'Gleich' }), 0.001)
  await put(await createJob(prisma, { title: 'Eigen gleich', source: 'own', userId: annaId, role: 'Andere' }), 0.001)
  await put(await createJob(prisma, { title: 'Älter', publishedAt: new Date(today.getTime() - 5 * 86_400_000) }), 0.002)
  await put(await createJob(prisma, { title: 'Neuer', publishedAt: today }), 0.003)
  await put(await createJob(prisma, { title: 'Eigen fern', source: 'own', userId: annaId, role: 'Andere' }), 0.004)

  const result = titles((await list()).body)
  expect(result.slice(0, 3).sort()).toEqual(['Eigen gleich', 'Gleich', 'Gleich'])
  expect(result.slice(3)).toEqual(['Älter', 'Neuer', 'Eigen fern'])
})

test('a deleted job still in ChromaDB is skipped and the next one moves up', async () => {
  await withVersion()
  const jobs = await ranked(25)
  await prisma.job.delete({ where: { id: jobs[0].id } })

  expect(titles((await list()).body)).toEqual(places(2, 21))
  expect(logs).toContain('job_search: 1 hits not visible')
  expect(listLine()).toContain('rounds 2')
})

test('with 20 jobs and one deleted the list has 19 after two rounds', async () => {
  await withVersion()
  const jobs = await ranked(20)
  await prisma.job.delete({ where: { id: jobs[4].id } })

  expect(titles((await list()).body)).toHaveLength(19)
  expect(listLine()).toContain('not visible 1 rounds 2')
})

test('deleted places 20 to 24 of 30 are replaced in a second round', async () => {
  await withVersion()
  const jobs = await ranked(30)
  await prisma.job.deleteMany({ where: { id: { in: jobs.slice(19, 24).map((job) => job.id) } } })

  expect(titles((await list()).body)).toEqual([...places(1, 19), 'Platz 25'])
  expect(logs).toContain('job_search: 5 hits not visible')
  expect(listLine()).toContain('rounds 2')
})

test('the rounds double without a limit until 20 jobs are found or the filter runs out', async () => {
  for (const [count, deleted, expected, rounds] of [
    [100, 50, places(51, 70), 3],
    [60, 45, places(46, 60), 3],
    [700, 660, places(661, 680), 7],
  ] as const) {
    await prisma.job.deleteMany()
    await prisma.cvVersion.deleteMany()
    await dropStores(chroma)
    await withVersion()
    logs.length = 0
    const jobs = await rankedMany(count)
    await prisma.job.deleteMany({ where: { id: { in: jobs.slice(0, deleted).map((job) => job.id) } } })

    expect(titles((await list()).body)).toEqual(expected)
    expect(logs).toContain(`job_search: ${deleted} hits not visible`)
    expect(listLine()).toContain(`rounds ${rounds}`)
  }
})

test('a pool job inside the window in ChromaDB but before it in PostgreSQL is skipped', async () => {
  await withVersion()
  const jobs = await ranked(25)
  const before = new Date(poolStart(new Date()).getTime() - 86_400_000)
  await prisma.job.update({ where: { id: jobs[0].id }, data: { publishedAt: before } })

  expect(titles((await list()).body)).toEqual(places(2, 21))
  expect(logs).toContain('job_search: 1 hits not visible')
})

test('the list calls no embedding client, no language model and records no run', async () => {
  await withVersion()
  await ranked(3)
  embedder.calls.length = 0
  await list()
  expect(embedder.calls).toEqual([])
  expect(messages.requests).toEqual([])
  expect(model.requests).toEqual([])
  expect(await prisma.llmRun.count()).toBe(0)
  expect(await prisma.matchResult.count()).toBe(0)
})

test('there are no feedback endpoints', async () => {
  expect((await request(app).put('/api/v1/search/jobs/feedback/1/1').set(headers)).status).toBe(404)
  expect((await request(app).delete('/api/v1/search/jobs/feedback/1/1').set(headers)).status).toBe(404)
})

test('an unreachable ChromaDB is 502 unavailable', async () => {
  const down = createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    ba: ba.client,
    searchIndex: testIndex(new ChromaClient({ host: '127.0.0.1', port: 9, ssl: false }), fakeEmbed().embed),
  })
  await createVersion(prisma, annaId)

  const response = await request(down).get('/api/v1/search/jobs').set(headers)

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'unavailable' })
  expect(logs.some((line) => line.startsWith('job_search: search failed'))).toBe(true)
})

test('every list writes one log line with counts, rounds, times and ids, and no text', async () => {
  await withVersion()
  const jobs = await ranked(2, { description: 'Zauberwort' })

  await list('?role=Backend')

  expect(logs.filter((line) => line.startsWith('job_search: list user'))).toHaveLength(1)
  expect(listLine()).toMatch(
    new RegExp(
      `^job_search: list user ${annaId} version ${versionId} role Backend hits 2 not visible 0 rounds 1 search \\d+ ms total \\d+ ms ids ${jobs[0].id},${jobs[1].id}$`,
      'u',
    ),
  )
  expect(logs.join('\n')).not.toMatch(/Zauberwort|similarity/u)
})

test('a list over 1,000 ms warns as slow', async () => {
  await withVersion()
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 400))
  await list()
  expect(logs.some((line) => /^job_search: slow list \d+ ms$/u.test(line))).toBe(true)
})

test('the list needs a token', async () => {
  expect((await request(app).get('/api/v1/search/jobs')).status).toBe(401)
})

test('the read generation is the one searched, the write generation is not', async () => {
  const index = testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 1 })
  const old = testIndex(chroma, embedder.embed, { storeGeneration: 1, listGeneration: 1 })
  const split = createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    ba: ba.client,
    searchIndex: index,
  })
  versionId = (await createVersion(prisma, annaId)).id
  const near = await createJob(prisma, { title: 'Alt nah' })
  const far = await createJob(prisma, { title: 'Alt fern' })
  await storeVector(old, `cv-${versionId}`, unitVector(0), { cvVersionId: versionId, userId: annaId })
  await storeVector(old, `job-${near.id}`, unitVector(0.1), metadata(near))
  await storeVector(old, `job-${far.id}`, unitVector(1), metadata(far))
  await storeVector(index, `cv-${versionId}`, unitVector(1), { cvVersionId: versionId, userId: annaId })
  await storeVector(index, `job-${far.id}`, unitVector(1), metadata(far))

  const response = await request(split).get('/api/v1/search/jobs').set(headers)

  expect(titles(response.body)).toEqual(['Alt nah', 'Alt fern'])
  expect(config.LIST_GENERATION).toBe(config.STORE_GENERATION)
})
