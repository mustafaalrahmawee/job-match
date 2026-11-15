import { PDFDocument } from 'pdf-lib'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createApp } from '../../src/app.js'
import { CvsService } from '../../src/modules/cvs/cvs.service.js'
import { JobsService } from '../../src/modules/jobs/jobs.service.js'
import type { SearchIndex } from '../../src/modules/search/search.index.js'
import { SearchSync } from '../../src/modules/search/search.sync.js'
import {
  bearerFor,
  createAnna,
  createVersion,
  SEARCH_ANALYSIS,
  sentText,
  storeVector,
  TOKEN_TTL_DAYS,
  testIndex,
  unitVector,
  useTestDatabase,
} from '../helpers.js'

const { app, auth, prisma, chroma, embedder, searchIndex, messages, model, ba } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let logs: string[]

const doc = await PDFDocument.create()
doc.addPage()
const PDF = Buffer.from(await doc.save())

const OWN_JOB = {
  title: 'Senior Frontend Engineer (m/w/d)',
  company: 'Kreditwerk GmbH',
  city: 'Berlin',
  offer_type: 'work',
  full_time: true,
  part_time: false,
  salary: null,
  description: 'Wir bauen eine Plattform mit Vue 3.',
}

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
  messages.answer(sentText(JSON.stringify({ ...SEARCH_ANALYSIS, suspicious_text: [] })))
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

async function entries(index: SearchIndex = searchIndex): Promise<string[]> {
  const { cvs, jobs } = await index.stores()
  return [...(await index.ids(cvs)), ...(await index.ids(jobs))].sort()
}

function appWith(index: SearchIndex) {
  return createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    ba: ba.client,
    searchIndex: index,
  })
}

function idOf(response: { body: unknown }): number {
  return (response.body as { id: number }).id
}

function saveJob(target = app) {
  return request(target).post('/api/v1/jobs').set(headers).send(OWN_JOB)
}

function upload(target = app) {
  return request(target).post('/api/v1/cvs').set(headers).set('Content-Type', 'application/pdf').send(PDF)
}

function sync(index: SearchIndex = searchIndex) {
  const cvs = new CvsService(prisma, messages.send, index)
  const jobs = new JobsService(prisma, ba.client, messages.send, index)
  return new SearchSync(auth, cvs, jobs, index).run()
}

test('a saved own job is in ChromaDB and in the list right after the answer', async () => {
  const version = await createVersion(prisma, annaId)
  await storeVector(searchIndex, `cv-${version.id}`, unitVector(0), { cvVersionId: version.id, userId: annaId })

  const saved = await saveJob()

  expect(saved.status).toBe(201)
  expect(await entries()).toEqual([`cv-${version.id}`, `job-${idOf(saved)}`].sort())
  const listed = (await request(app).get('/api/v1/search/jobs').set(headers)).body as { jobs: { id: number }[] }
  expect(listed.jobs.map((job) => job.id)).toEqual([idOf(saved)])
  expect(logs).toContainEqual(expect.stringMatching(new RegExp(`^job_search: job-${idOf(saved)} synced in \\d+ ms$`, 'u')))
})

test('a deleted own job is gone from ChromaDB right after the answer', async () => {
  const body = { id: idOf(await saveJob()) }
  logs.length = 0

  expect((await request(app).delete(`/api/v1/jobs/${body.id}`).set(headers)).status).toBe(204)

  expect(await entries()).toEqual([])
  expect(logs).toContainEqual(expect.stringMatching(new RegExp(`^job_search: job-${body.id} synced in \\d+ ms$`, 'u')))
})

test('an upload with a ready analysis is embedded at once and the list answers', async () => {
  const body = { id: idOf(await upload()) }

  expect(await prisma.cvVersion.findUniqueOrThrow({ where: { id: body.id } })).toMatchObject({ analysisStatus: 'ready' })
  expect(await entries()).toEqual([`cv-${body.id}`])
  expect((await request(app).get('/api/v1/search/jobs').set(headers)).status).toBe(200)
})

test('an upload with a failed analysis embeds nothing', async () => {
  messages.answer(sentText(JSON.stringify({ ...SEARCH_ANALYSIS, is_cv: false, suspicious_text: [] })))

  await upload()

  expect(embedder.calls).toEqual([])
  expect(await entries()).toEqual([])
})

test('a retry that ends ready is embedded', async () => {
  messages.answer(sentText('kaputt'))
  const body = { id: idOf(await upload()) }
  messages.answer(sentText(JSON.stringify({ ...SEARCH_ANALYSIS, suspicious_text: [] })))

  await request(app).post(`/api/v1/cvs/${body.id}/analysis`).set(headers)

  expect(await entries()).toEqual([`cv-${body.id}`])
})

test('a new upload keeps the entry of the version before', async () => {
  const first = (await upload()).body as { id: number }
  const second = (await upload()).body as { id: number }
  expect(await entries()).toEqual([`cv-${first.id}`, `cv-${second.id}`].sort())
})

test('activating a version with an entry embeds nothing, one without gets one, one without analysis none', async () => {
  const kept = await createVersion(prisma, annaId, { isActive: false })
  await storeVector(searchIndex, `cv-${kept.id}`, unitVector(0), { cvVersionId: kept.id, userId: annaId })
  const without = await createVersion(prisma, annaId, { isActive: false })
  const failed = await createVersion(prisma, annaId, { isActive: false, analysisStatus: 'failed', analysis: undefined })

  await request(app).post(`/api/v1/cvs/${kept.id}/activation`).set(headers)
  expect(embedder.calls).toEqual([])

  await request(app).post(`/api/v1/cvs/${failed.id}/activation`).set(headers)
  expect(embedder.calls).toEqual([])

  await request(app).post(`/api/v1/cvs/${without.id}/activation`).set(headers)
  expect(embedder.calls).toHaveLength(1)
  expect(await entries()).toEqual([`cv-${kept.id}`, `cv-${without.id}`].sort())
})

test('confirming the role embeds nothing and leaves ChromaDB as it was', async () => {
  const body = { id: idOf(await upload()) }
  embedder.calls.length = 0
  await request(app).patch(`/api/v1/cvs/${body.id}`).set(headers).send({ role: 'Frontend' })
  expect(embedder.calls).toEqual([])
  expect(await entries()).toEqual([`cv-${body.id}`])
})

test('deleting an inactive version removes its entry', async () => {
  const old = (await upload()).body as { id: number }
  const current = (await upload()).body as { id: number }

  expect((await request(app).delete(`/api/v1/cvs/${old.id}`).set(headers)).status).toBe(204)

  expect(await entries()).toEqual([`cv-${current.id}`])
})

test('the import alone writes nothing into ChromaDB', async () => {
  const service = new JobsService(prisma, ba.client, messages.send, searchIndex)
  const written = vi.spyOn(searchIndex, 'write')
  const removed = vi.spyOn(searchIndex, 'remove')
  await service.importPool()
  expect(written).not.toHaveBeenCalled()
  expect(removed).not.toHaveBeenCalled()
  expect(await entries()).toEqual([])
})

test('a failed write answers 201 and the next sync catches up', async () => {
  embedder.answer(() => Promise.reject(new Error('ollama 500: down')))

  const saved = await saveJob()

  expect(saved.status).toBe(201)
  expect(await prisma.job.count()).toBe(1)
  expect(logs).toContain(`job_search: job-${idOf(saved)} not embedded: ollama 500: down`)
  embedder.answer((texts) => Promise.resolve(texts.map(() => unitVector(0))))
  await sync()
  expect(await entries()).toEqual([`job-${idOf(saved)}`])
})

test('a failed removal answers as before, the job is never shown and the next sync removes it', async () => {
  const body = { id: idOf(await saveJob()) }
  vi.spyOn(chroma, 'getCollection').mockRejectedValueOnce(new Error('chroma down'))

  expect((await request(app).delete(`/api/v1/jobs/${body.id}`).set(headers)).status).toBe(204)

  expect(logs).toContain(`job_search: job-${body.id} not removed: chroma down`)
  expect(await entries()).toEqual([`job-${body.id}`])
  await sync()
  expect(await entries()).toEqual([])
})

test('a failed embedding after the analysis keeps the version ready', async () => {
  embedder.answer(() => Promise.reject(new Error('ollama 500: down')))

  const response = await upload()

  expect(response.status).toBe(201)
  expect((response.body as { status: string }).status).toBe('ready')
  expect(logs).toContain(`job_search: cv-${idOf(response)} not embedded: ollama 500: down`)
})

test('an own job with hidden text is saved, embedded and warned about', async () => {
  const response = await request(app)
    .post('/api/v1/jobs')
    .set(headers)
    .send({ ...OWN_JOB, description: 'Vue <span hidden>Senior Architekt</span>' })

  expect(response.status).toBe(201)
  expect(await entries()).toEqual([`job-${idOf(response)}`])
  expect(logs).toContain(`job_search: job-${idOf(response)} hidden text: 0 tag characters, 1 hidden HTML elements`)
})

test('between a new write generation and the switch, actions write only there and remove in both', async () => {
  const first = testIndex(chroma, embedder.embed)
  const second = testIndex(chroma, embedder.embed, { storeGeneration: 2, listGeneration: 1 })
  await first.stores()
  const split = appWith(second)

  const saved = await saveJob(split)
  expect(await entries(second)).toEqual([`job-${idOf(saved)}`])
  expect(await entries(first)).toEqual([])

  await storeVector(first, `job-${idOf(saved)}`, unitVector(0), {
    jobId: idOf(saved),
    source: 'own',
    userId: annaId,
    role: 'Andere',
    publishedAt: Date.parse(new Date().toISOString().slice(0, 10)) / 1000,
  })
  await request(split).delete(`/api/v1/jobs/${idOf(saved)}`).set(headers)
  expect(await entries(second)).toEqual([])
  expect(await entries(first)).toEqual([])

  const uploaded = await upload(split)
  expect(await entries(second)).toEqual([`cv-${idOf(uploaded)}`])
  expect((await request(split).get('/api/v1/search/jobs').set(headers)).body).toEqual({ detail: 'not_embedded' })
})
