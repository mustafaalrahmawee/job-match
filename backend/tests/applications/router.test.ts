import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import type { Job } from '../../src/generated/prisma/client.js'
import { NOTE_MAX_CHARS } from '../../src/modules/applications/applications.schemas.js'
import { bearerFor, createAnna, useTestDatabase } from '../helpers.js'

const { app, auth, prisma } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let job: Job

type Detail = {
  id: number
  status: string
  match_score: number | null
  history: { status: string; changed_at: string }[]
  notes: { id: number; content: string; created_at: string }[]
}

type Item = { id: number; status: string; applied_at: string | null; changed_at: string; match_score: number | null }

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
  job = await poolJob('Senior Frontend Engineer (m/w/d)')
})

function poolJob(title: string) {
  return prisma.job.create({
    data: {
      source: 'ba',
      externalId: `10000-${Math.random()}`,
      title,
      company: 'Kreditwerk GmbH',
      city: 'Berlin',
      description: 'Vue 3, TypeScript',
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })
}

function ownJob(userId: number) {
  return prisma.job.create({
    data: {
      source: 'own',
      userId,
      externalId: `own-${Math.random()}`,
      title: 'Web Developer Vue',
      city: 'Hamburg',
      description: 'Vue 3',
      offerType: 'work',
      role: 'Andere',
      fullTime: false,
      partTime: true,
      publishedAt: new Date(),
    },
  })
}

function create(jobId = job.id, auth = headers) {
  return request(app).post('/api/v1/applications').set(auth).send({ job_id: jobId })
}

function setStatus(id: number, status: string, auth = headers) {
  return request(app).patch(`/api/v1/applications/${id}`).set(auth).send({ status })
}

async function list() {
  return (await request(app).get('/api/v1/applications').set(headers)).body as Item[]
}

async function detail(id: number) {
  return (await request(app).get(`/api/v1/applications/${id}`).set(headers)).body as Detail
}

function addNote(id: number, content: string, auth = headers) {
  return request(app).post(`/api/v1/applications/${id}/notes`).set(auth).send({ content })
}

async function created(jobId = job.id, auth = headers) {
  return (await create(jobId, auth)).body as Detail
}

async function cv(isActive: boolean, role: string) {
  return prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), isActive, analysisStatus: 'ready', role },
  })
}

test('every route needs a login', async () => {
  const responses = await Promise.all([
    request(app).get('/api/v1/applications'),
    request(app).post('/api/v1/applications').send({ job_id: job.id }),
    request(app).get('/api/v1/applications/1'),
    request(app).patch('/api/v1/applications/1').send({ status: 'applied' }),
    request(app).post('/api/v1/applications/1/notes').send({ content: 'Hallo' }),
  ])

  for (const response of responses) {
    expect(response.status).toBe(401)
    expect(response.headers['www-authenticate']).toBe('Bearer')
  }
})

test('a new application is saved with a dated first step in the history', async () => {
  const before = Date.now()

  const response = await create()

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({
    status: 'saved',
    match_score: null,
    job: {
      id: job.id,
      source: 'ba',
      title: 'Senior Frontend Engineer (m/w/d)',
      company: 'Kreditwerk GmbH',
      city: 'Berlin',
      offer_type: 'work',
      full_time: true,
      part_time: false,
    },
    notes: [],
  })
  const { history } = response.body as Detail
  expect(history).toHaveLength(1)
  expect(history[0].status).toBe('saved')
  expect(Date.parse(history[0].changed_at)).toBeGreaterThanOrEqual(before - 1000)
  expect(await prisma.application.count({ where: { userId: annaId } })).toBe(1)
})

test('a job gets one application per account', async () => {
  await create()

  const response = await create()

  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'exists' })
  expect(await prisma.application.count()).toBe(1)
})

test('an own job of another account or an unknown job cannot get an application', async () => {
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const own = await ownJob(ben.id)

  expect((await create(own.id)).status).toBe(404)
  expect((await create(999999)).status).toBe(404)
  expect(await prisma.application.count()).toBe(0)
})

test('an own job can get an application', async () => {
  const own = await ownJob(annaId)

  const response = await create(own.id)

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({ job: { id: own.id, source: 'own', company: null, part_time: true } })
})

test('invalid input is rejected with 422', async () => {
  const { id } = await created()

  expect((await request(app).post('/api/v1/applications').set(headers).send({ job_id: 'x' })).status).toBe(422)
  expect((await setStatus(id, 'hired')).status).toBe(422)
  expect((await request(app).get('/api/v1/applications/abc').set(headers)).status).toBe(422)
  expect((await addNote(id, '   ')).status).toBe(422)
  expect((await addNote(id, 'x'.repeat(NOTE_MAX_CHARS + 1))).status).toBe(422)
})

test('every status change is dated and the history shows the newest step first', async () => {
  const { id } = await created()

  await setStatus(id, 'applied')
  const response = await setStatus(id, 'interview')

  expect(response.status).toBe(200)
  const body = response.body as Detail
  expect(body.status).toBe('interview')
  expect(body.history.map((step) => step.status)).toEqual(['interview', 'applied', 'saved'])
  for (const step of body.history) expect(Number.isNaN(Date.parse(step.changed_at))).toBe(false)
  const stored = await prisma.statusChange.findMany({ where: { applicationId: id }, orderBy: { id: 'asc' } })
  expect(stored.map((change) => change.status)).toEqual(['saved', 'applied', 'interview'])
})

test('setting the same status again adds no step', async () => {
  const { id } = await created()
  await setStatus(id, 'applied')

  const response = await setStatus(id, 'applied')

  expect(response.status).toBe(200)
  expect((response.body as Detail).history).toHaveLength(2)
})

test('notes are stored with their date and shown newest first', async () => {
  const { id } = await created()

  const first = await addNote(id, '  Anschreiben per Portal gesendet.  ')
  await addNote(id, 'Gespräch am Donnerstag.')

  expect(first.status).toBe(201)
  const note = first.body as Detail['notes'][number]
  expect(note.content).toBe('Anschreiben per Portal gesendet.')
  expect(Number.isNaN(Date.parse(note.created_at))).toBe(false)
  expect((await detail(id)).notes.map((entry) => entry.content)).toEqual([
    'Gespräch am Donnerstag.',
    'Anschreiben per Portal gesendet.',
  ])
})

test('an application of another account behaves as if it did not exist', async () => {
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const { id } = await created(job.id, await bearerFor(auth, ben))

  expect((await request(app).get(`/api/v1/applications/${id}`).set(headers)).status).toBe(404)
  expect((await setStatus(id, 'withdrawn')).status).toBe(404)
  expect((await addNote(id, 'Fremd')).status).toBe(404)
  expect(await list()).toEqual([])
  expect(await prisma.statusChange.count({ where: { applicationId: id } })).toBe(1)
  expect(await prisma.note.count()).toBe(0)
})

test('the list is sorted by the last status change and shows applied date, notes and the last step', async () => {
  const older = await created()
  const newer = await created((await poolJob('Web Developer Vue')).id)
  await setStatus(older.id, 'applied')
  await addNote(newer.id, 'Notiz')

  const items = await list()

  expect(items.map((item) => item.id)).toEqual([older.id, newer.id])
  const [applied, saved] = items
  expect(applied).toMatchObject({ status: 'applied', notes: 0, job: { id: job.id, title: job.title, city: 'Berlin' } })
  expect(applied.applied_at).toBe(applied.changed_at)
  expect(saved).toMatchObject({ status: 'saved', applied_at: null, notes: 1 })
})

test('the applied date stays the first one after going back and forth', async () => {
  await prisma.application.create({
    data: {
      userId: annaId,
      jobId: job.id,
      status: 'applied',
      statusChanges: {
        create: [
          { status: 'saved', changedAt: new Date('2026-10-05T12:00:00Z') },
          { status: 'applied', changedAt: new Date('2026-10-08T12:00:00Z') },
          { status: 'saved', changedAt: new Date('2026-10-09T12:00:00Z') },
          { status: 'applied', changedAt: new Date('2026-10-10T12:00:00Z') },
        ],
      },
    },
  })

  const [item] = await list()

  expect(item.applied_at).toBe('2026-10-08T12:00:00.000Z')
  expect(item.changed_at).toBe('2026-10-10T12:00:00.000Z')
})

test('the list stays complete after a role change, a new CV version and deleting the old one', async () => {
  const old = await cv(true, 'Frontend')
  await prisma.matchResult.create({
    data: { userId: annaId, cvVersionId: old.id, jobId: job.id, score: 68, strengths: [], gaps: [], tips: [] },
  })
  const { id } = await created()
  expect((await list())[0].match_score).toBe(68)

  await prisma.cvVersion.update({ where: { id: old.id }, data: { role: 'Fullstack' } })
  expect((await list()).map((item) => item.id)).toEqual([id])

  await prisma.cvVersion.update({ where: { id: old.id }, data: { isActive: false } })
  const current = await cv(true, 'Backend')
  const afterNewVersion = await list()
  expect(afterNewVersion).toHaveLength(1)
  expect(afterNewVersion[0].match_score).toBeNull()

  await prisma.matchResult.create({
    data: { userId: annaId, cvVersionId: current.id, jobId: job.id, score: 74, strengths: [], gaps: [], tips: [] },
  })
  await prisma.cvVersion.delete({ where: { id: old.id } })
  const afterDelete = await list()
  expect(afterDelete).toHaveLength(1)
  expect(afterDelete[0].match_score).toBe(74)
  expect((await detail(id)).match_score).toBe(74)
})
