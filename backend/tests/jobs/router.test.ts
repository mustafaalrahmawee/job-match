import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import type { Prisma } from '../../src/generated/prisma/client.js'
import { bearerFor, createAnna, useTestDatabase } from '../helpers.js'

const { app, auth, prisma } = useTestDatabase()
let headers: { Authorization: string }

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): Date {
  return new Date(new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10))
}

function job(externalId: string, data: Partial<Prisma.JobCreateManyInput> = {}): Prisma.JobCreateManyInput {
  return {
    source: 'ba',
    externalId,
    title: `Stelle ${externalId}`,
    company: 'Mediahaus GmbH',
    city: 'Berlin',
    description: 'Text der Anzeige',
    offerType: 'work',
    role: 'Frontend',
    fullTime: true,
    partTime: false,
    publishedAt: daysAgo(1),
    ...data,
  }
}

beforeEach(async () => {
  headers = await bearerFor(auth, await createAnna(auth))
})

function list(query = '') {
  return request(app).get(`/api/v1/jobs${query}`).set(headers)
}

type Body = { total: number; pool_updated_at: string | null; jobs: Record<string, unknown>[] }

test('the list needs a login', async () => {
  const response = await request(app).get('/api/v1/jobs')

  expect(response.status).toBe(401)
  expect(response.headers['www-authenticate']).toBe('Bearer')
})

test('the pool lists jobs of the last 30 days, newest first, without the text', async () => {
  await prisma.job.createMany({
    data: [
      job('a', { publishedAt: daysAgo(5) }),
      job('b', { publishedAt: daysAgo(1), offerType: 'internship', company: null, partTime: true }),
      job('c', { publishedAt: daysAgo(31) }),
    ],
  })
  const run = await prisma.jobImport.create({ data: { imported: 3, duplicates: 0, filtered: 0, failed: 0 } })

  const response = await list()

  expect(response.status).toBe(200)
  const body = response.body as Body
  expect(body.total).toBe(2)
  expect(body.pool_updated_at).toBe(run.createdAt.toISOString())
  expect(body.jobs.map((entry) => entry.title)).toEqual(['Stelle b', 'Stelle a'])
  expect(body.jobs[0]).toEqual({
    id: expect.any(Number) as number,
    source: 'ba',
    title: 'Stelle b',
    company: null,
    city: 'Berlin',
    region: null,
    offer_type: 'internship',
    role: 'Frontend',
    full_time: true,
    part_time: true,
    published_at: daysAgo(1).toISOString().slice(0, 10),
  })
})

test('without an import the pool has no update time', async () => {
  const body = (await list()).body as Body

  expect(body).toEqual({ total: 0, pool_updated_at: null, jobs: [] })
})

test('the list filters by role', async () => {
  await prisma.job.createMany({ data: [job('a'), job('b', { role: 'UX/UI' })] })

  const body = (await list('?role=UX%2FUI')).body as Body

  expect(body.total).toBe(1)
  expect(body.jobs.map((entry) => entry.title)).toEqual(['Stelle b'])
})

test('the list filters by federal state, working time and offer type', async () => {
  await prisma.job.createMany({
    data: [
      job('a', { region: 'BAYERN', fullTime: true, partTime: false }),
      job('b', { region: 'BAYERN', fullTime: true, partTime: true, offerType: 'apprenticeship' }),
      job('c', { region: 'SACHSEN', fullTime: false, partTime: true }),
    ],
  })
  const titles = async (query: string) => ((await list(query)).body as Body).jobs.map((entry) => entry.title).sort()

  expect(await titles('?region=BAYERN')).toEqual(['Stelle a', 'Stelle b'])
  expect(await titles('?work_time=full')).toEqual(['Stelle a', 'Stelle b'])
  expect(await titles('?work_time=part')).toEqual(['Stelle b', 'Stelle c'])
  expect(await titles('?offer_type=apprenticeship')).toEqual(['Stelle b'])
  expect(await titles('?region=BAYERN&work_time=part')).toEqual(['Stelle b'])
  expect(((await list('?region=SACHSEN')).body as Body).jobs[0].region).toBe('SACHSEN')
})

test('the search looks at title, company and city without case', async () => {
  await prisma.job.createMany({
    data: [
      job('a', { title: 'Vue Entwicklerin' }),
      job('b', { company: 'VUEtiful AG' }),
      job('c', { city: 'Vuerde' }),
      job('d', { title: 'React Developer' }),
    ],
  })

  const body = (await list('?q=vue')).body as Body

  expect(body.total).toBe(3)
  expect(body.jobs.map((entry) => entry.title).sort()).toEqual(['Stelle b', 'Stelle c', 'Vue Entwicklerin'])
})

test('offset and limit page through the list', async () => {
  await prisma.job.createMany({ data: [1, 2, 3].map((day) => job(`j${day}`, { publishedAt: daysAgo(day) })) })

  const body = (await list('?offset=1&limit=1')).body as Body

  expect(body.total).toBe(3)
  expect(body.jobs.map((entry) => entry.title)).toEqual(['Stelle j2'])
})

test('an unknown role or a negative offset is rejected', async () => {
  expect((await list('?role=Koch')).status).toBe(422)
  expect((await list('?offset=-1')).status).toBe(422)
  expect((await list('?limit=500')).status).toBe(422)
  expect((await list('?region=Bayern')).status).toBe(422)
  expect((await list('?work_time=both')).status).toBe(422)
  expect((await list('?offer_type=ARBEIT')).status).toBe(422)
})

test('a job shows its text and the link to the Bundesagentur', async () => {
  const { id } = await prisma.job.create({ data: job('10001-1003781061-S', { description: '### Aufgaben\n\nVue 3' }) })

  const response = await request(app).get(`/api/v1/jobs/${id}`).set(headers)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    id,
    title: 'Stelle 10001-1003781061-S',
    description: '### Aufgaben\n\nVue 3',
    salary: null,
    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1003781061-S',
  })
})

test('an older pool job still opens by id', async () => {
  const { id } = await prisma.job.create({ data: job('alt', { publishedAt: daysAgo(40) }) })

  expect((await request(app).get(`/api/v1/jobs/${id}`).set(headers)).status).toBe(200)
})

test('an unknown job is 404, a wrong id 422, without login 401', async () => {
  expect((await request(app).get('/api/v1/jobs/999999').set(headers)).status).toBe(404)
  expect((await request(app).get('/api/v1/jobs/abc').set(headers)).status).toBe(422)
  expect((await request(app).get('/api/v1/jobs/1')).status).toBe(401)
})
