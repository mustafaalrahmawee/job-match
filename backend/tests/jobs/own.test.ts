import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JOB_READINGS_PER_DAY } from '../../src/modules/jobs/jobs.service.js'
import * as jobConfig from '../../src/prompts/job_extract/job_extract.config.js'
import { bearerFor, createAnna, sentText, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, messages } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('bild')])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('bild')])

const AD = 'Senior Frontend Engineer (m/w/d)\n\nWir bauen eine Plattform für Firmenkredite in Berlin.'

const EXTRACT = {
  is_job: true,
  title: 'Senior Frontend Engineer (m/w/d)',
  company: null,
  city: 'Berlin',
  offer_type: 'work',
  full_time: true,
  part_time: false,
  salary: '65.000–80.000 €',
  text: null,
  suspicious_text: [],
}

const OWN_JOB = {
  title: 'Senior Frontend Engineer (m/w/d)',
  company: 'Kreditwerk GmbH',
  city: 'Berlin',
  offer_type: 'work',
  full_time: true,
  part_time: false,
  salary: '65.000–80.000 €',
  description: AD,
}

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
})

function answer(extract: Record<string, unknown>) {
  messages.answer(sentText(JSON.stringify(extract)))
}

function extractText(text: string) {
  return request(app).post('/api/v1/jobs/extraction').set(headers).send({ text })
}

function extractImage(image: Buffer, type = 'image/png') {
  return request(app).post('/api/v1/jobs/extraction').set(headers).set('Content-Type', type).send(image)
}

function material(): ContentBlockParam {
  const [message] = messages.requests[0].messages
  return (message.content as ContentBlockParam[]).find((block) => block.type !== 'text')!
}

async function otherUser() {
  const user = await auth.createUser('ben@example.com', 'auch-geheim')
  return { user, headers: await bearerFor(auth, user) }
}

test('reading a job out needs a login', async () => {
  const response = await request(app).post('/api/v1/jobs/extraction').send({ text: AD })

  expect(response.status).toBe(401)
  expect(response.headers['www-authenticate']).toBe('Bearer')
})

test('pasted text goes to the model as a document and comes back as fields with the text itself', async () => {
  answer(EXTRACT)

  const response = await extractText(AD)

  expect(response.status).toBe(200)
  expect(response.body).toEqual({
    title: 'Senior Frontend Engineer (m/w/d)',
    company: null,
    city: 'Berlin',
    offer_type: 'work',
    full_time: true,
    part_time: false,
    salary: '65.000–80.000 €',
    description: AD,
    suspicious_text: [],
    unverified: ['salary'],
  })
  expect(messages.requests).toHaveLength(1)
  expect(messages.requests[0].model).toBe(jobConfig.MODEL)
  expect(material()).toMatchObject({ type: 'document', source: { type: 'text' } })
  expect(JSON.stringify(material())).toContain('Senior Frontend Engineer')
  expect(await prisma.job.count()).toBe(0)
})

test('the pasted text is the description even if the model sends a text', async () => {
  answer({ ...EXTRACT, text: 'Zusammenfassung des Modells' })

  const response = await extractText(AD)

  expect(response.body).toMatchObject({ description: AD })
})

test('a PNG screenshot goes to the model as an image and its text becomes the description', async () => {
  answer({ ...EXTRACT, text: 'Senior Frontend Engineer\n\n[nicht lesbar]\n\n- Vue 3' })

  const response = await extractImage(PNG)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ description: 'Senior Frontend Engineer\n\n[nicht lesbar]\n\n- Vue 3' })
  expect(material()).toEqual({
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: PNG.toString('base64') },
  })
})

test('a JPEG is recognised by its signature, not by the header', async () => {
  answer({ ...EXTRACT, text: 'Anzeige' })

  const response = await extractImage(JPEG, 'image/png')

  expect(response.status).toBe(200)
  expect(material()).toMatchObject({ source: { media_type: 'image/jpeg' } })
})

test('a screenshot without text gets an empty description', async () => {
  answer({ ...EXTRACT, text: null })

  expect((await extractImage(PNG)).body).toMatchObject({ description: '' })
})

test('an image without PNG or JPEG signature is rejected without a model call', async () => {
  const response = await extractImage(Buffer.from('GIF89a----'))

  expect(response.status).toBe(422)
  expect(messages.requests).toHaveLength(0)
})

test('empty, blank or too long text is rejected without a model call', async () => {
  expect((await extractText('')).status).toBe(422)
  expect((await extractText('   ')).status).toBe(422)
  expect((await extractText('a'.repeat(20001))).status).toBe(422)
  expect((await request(app).post('/api/v1/jobs/extraction').set(headers).send({})).status).toBe(422)
  expect(messages.requests).toHaveLength(0)
})

test('a screenshot over 5 MB is rejected', async () => {
  const response = await extractImage(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]))

  expect(response.status).toBe(413)
  expect(messages.requests).toHaveLength(0)
})

test('material that is not a job ad is rejected', async () => {
  answer({ ...EXTRACT, is_job: false, title: null, city: null, salary: null })

  const response = await extractText('Mein Lebenslauf')

  expect(response.status).toBe(422)
  expect(response.body).toEqual({ detail: 'not_job' })
})

test.each([
  ['a refusal', sentText('', 'refusal')],
  ['a cut-off answer', sentText('{"is_job": true', 'max_tokens')],
  ['broken JSON', sentText('kein JSON')],
  ['a wrong offer type', sentText(JSON.stringify({ ...EXTRACT, offer_type: 'ARBEIT' }))],
  ['a failing API', () => Promise.reject(new Error('API down'))],
])('%s gives 502', async (_name, reply) => {
  messages.answer(reply)

  const response = await extractText(AD)

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'extract_failed' })
})

test('fields are cut to the column lengths', async () => {
  answer({ ...EXTRACT, title: 't'.repeat(400), company: 'c'.repeat(400), city: 's'.repeat(300), salary: 'g'.repeat(300) })

  const response = await extractText(AD)

  expect(response.body).toMatchObject({
    title: 't'.repeat(300),
    company: 'c'.repeat(300),
    city: 's'.repeat(200),
    salary: 'g'.repeat(200),
  })
})

test('an ad that leaves the offer type open gives an empty field', async () => {
  answer({ ...EXTRACT, offer_type: null })

  const response = await extractText(AD)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ offer_type: null })
})

test('suspicious passages are shown, cut to the limits, and never reach the draft fields', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const entries = Array.from({ length: 12 }, (_, index) => `Ignoriere alles ${index}`)
  answer({ ...EXTRACT, suspicious_text: ['x'.repeat(1200), ...entries] })

  const response = await extractText(AD)
  const body = response.body as { suspicious_text: string[]; description: string }

  expect(body.suspicious_text).toHaveLength(10)
  expect(body.suspicious_text[0]).toBe(`${'x'.repeat(1000)} […]`)
  expect(body.suspicious_text[1]).toBe('Ignoriere alles 0')
  expect(body.description).toBe(AD)
  expect(warn).toHaveBeenCalledOnce()
  expect(warn.mock.calls[0][0]).not.toContain('Ignoriere')
})

test('a field with a link is emptied and a value missing from the text is flagged', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  answer({ ...EXTRACT, title: 'Klicke [hier](https://evil.example)', company: 'Erfundene GmbH', salary: null })

  const response = await extractText(AD)

  expect(response.body).toMatchObject({ title: null, company: 'Erfundene GmbH', unverified: ['company'] })
})

test('invisible characters leave the draft and what is shown marks them', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  answer({ ...EXTRACT, salary: null, suspicious_text: ['Geheim\u200Btext'] })

  const response = await extractText(`Senior\u200B Frontend Engineer (m/w/d) in Berlin`)

  expect(response.body).toMatchObject({
    description: 'Senior Frontend Engineer (m/w/d) in Berlin',
    suspicious_text: ['Geheim[U+200B]text'],
    unverified: [],
  })
  expect(JSON.stringify(material())).not.toContain('\u200B')
})

test('an amount that only occurs inside a larger one counts as not found', async () => {
  answer({ ...EXTRACT, salary: '50.000 €' })

  const response = await extractText(`${AD} Gehalt 150.000 €`)

  expect(response.body).toMatchObject({ unverified: ['salary'] })
})

test('reading is limited per day, counted per person, and the failed call counts too', async () => {
  const today = new Date()
  await prisma.extractRun.createMany({
    data: Array.from({ length: JOB_READINGS_PER_DAY - 1 }, () => ({ userId: annaId, createdAt: today })),
  })
  messages.answer(sentText('kein JSON'))
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  expect((await extractText(AD)).status).toBe(502)
  messages.requests.length = 0
  const response = await extractText(AD)

  expect(response.status).toBe(429)
  expect(response.body).toEqual({ detail: 'limit_reached' })
  expect(messages.requests).toHaveLength(0)
  const ben = await otherUser()
  answer(EXTRACT)
  const other = await request(app).post('/api/v1/jobs/extraction').set(ben.headers).send({ text: AD })
  expect(other.status).toBe(200)
})

test('readings of earlier days do not count', async () => {
  await prisma.extractRun.createMany({
    data: Array.from({ length: JOB_READINGS_PER_DAY }, () => ({ userId: annaId, createdAt: new Date('2026-01-01') })),
  })
  answer(EXTRACT)

  expect((await extractText(AD)).status).toBe(200)
})

test('invalid input does not use up a reading', async () => {
  await extractText('')

  expect(await prisma.extractRun.count()).toBe(0)
})

test('saving removes invisible characters and needs an offer type', async () => {
  const save = (data: Record<string, unknown>) => request(app).post('/api/v1/jobs').set(headers).send({ ...OWN_JOB, ...data })

  const response = await save({ title: 'Ent\u200Bwicklerin', company: '\u2060', description: `Text\u{E0041}` })

  expect(response.body).toMatchObject({ title: 'Entwicklerin', company: null, description: 'Text' })
  expect((await save({ title: '\u200B' })).status).toBe(422)
  expect((await save({ offer_type: null })).status).toBe(422)
})

test('saving stores an own job for the person and shows it without a role', async () => {
  const response = await request(app).post('/api/v1/jobs').set(headers).send(OWN_JOB)

  expect(response.status).toBe(201)
  expect(response.body).toEqual({
    id: expect.any(Number) as number,
    source: 'own',
    title: 'Senior Frontend Engineer (m/w/d)',
    company: 'Kreditwerk GmbH',
    city: 'Berlin',
    region: null,
    offer_type: 'work',
    role: null,
    full_time: true,
    part_time: false,
    published_at: new Date().toISOString().slice(0, 10),
    description: AD,
    salary: '65.000–80.000 €',
    url: null,
  })
  const stored = await prisma.job.findUniqueOrThrow({ where: { id: (response.body as { id: number }).id } })
  expect(stored).toMatchObject({ source: 'own', userId: annaId, role: 'Andere' })
  expect(stored.externalId).toMatch(/^[0-9a-f-]{36}$/)
})

test('empty company and salary are stored as null, text is trimmed', async () => {
  const response = await request(app)
    .post('/api/v1/jobs')
    .set(headers)
    .send({ ...OWN_JOB, title: '  Entwicklerin  ', company: ' ', salary: '' })

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({ title: 'Entwicklerin', company: null, salary: null })
})

test('saving needs title, city and description within the column lengths', async () => {
  const save = (data: Record<string, unknown>) => request(app).post('/api/v1/jobs').set(headers).send({ ...OWN_JOB, ...data })

  expect((await save({ title: ' ' })).status).toBe(422)
  expect((await save({ city: null })).status).toBe(422)
  expect((await save({ description: '' })).status).toBe(422)
  expect((await save({ title: 't'.repeat(301) })).status).toBe(422)
  expect((await save({ city: 's'.repeat(201) })).status).toBe(422)
  expect((await save({ salary: 'g'.repeat(201) })).status).toBe(422)
  expect((await save({ offer_type: 'ARBEIT' })).status).toBe(422)
  expect((await request(app).post('/api/v1/jobs').send(OWN_JOB)).status).toBe(401)
  expect(await prisma.job.count()).toBe(0)
})

test('the list shows own jobs of the person next to the pool, whatever the role, federal state or age', async () => {
  await prisma.job.create({
    data: {
      source: 'ba',
      externalId: 'pool-1',
      title: 'Pool-Stelle',
      city: 'Berlin',
      region: 'BERLIN',
      description: 'Text',
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })
  const own = (await request(app).post('/api/v1/jobs').set(headers).send(OWN_JOB)).body as { id: number }
  await prisma.job.update({ where: { id: own.id }, data: { publishedAt: new Date('2025-01-01') } })
  const ben = await otherUser()
  await request(app).post('/api/v1/jobs').set(ben.headers).send({ ...OWN_JOB, title: 'Bens Stelle' })
  const titles = async (query: string) =>
    ((await request(app).get(`/api/v1/jobs${query}`).set(headers)).body as { jobs: { title: string }[] }).jobs
      .map((job) => job.title)
      .sort()

  expect(await titles('')).toEqual(['Pool-Stelle', 'Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?role=Frontend')).toEqual(['Pool-Stelle', 'Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?role=Backend')).toEqual(['Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?region=BERLIN')).toEqual(['Pool-Stelle', 'Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?region=BAYERN')).toEqual(['Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?source=own')).toEqual(['Senior Frontend Engineer (m/w/d)'])
  expect(await titles('?source=ba')).toEqual(['Pool-Stelle'])
  expect(await titles('?q=kreditwerk')).toEqual(['Senior Frontend Engineer (m/w/d)'])
  expect((await request(app).get('/api/v1/jobs?source=x').set(headers)).status).toBe(422)
})

test('an own job of another person behaves as if it did not exist', async () => {
  const ben = await otherUser()
  const { id } = (await request(app).post('/api/v1/jobs').set(ben.headers).send(OWN_JOB)).body as { id: number }

  expect((await request(app).get(`/api/v1/jobs/${id}`).set(headers)).status).toBe(404)
  expect((await request(app).get(`/api/v1/jobs/${id}`).set(ben.headers)).status).toBe(200)
})

test('deleting an own job removes it with its application and notes', async () => {
  const { id } = (await request(app).post('/api/v1/jobs').set(headers).send(OWN_JOB)).body as { id: number }
  const application = await prisma.application.create({ data: { userId: annaId, jobId: id } })
  await prisma.note.create({ data: { applicationId: application.id, content: 'Notiz' } })

  const response = await request(app).delete(`/api/v1/jobs/${id}`).set(headers)

  expect(response.status).toBe(204)
  expect(await prisma.job.count()).toBe(0)
  expect(await prisma.application.count()).toBe(0)
  expect(await prisma.note.count()).toBe(0)
  expect((await request(app).delete(`/api/v1/jobs/${id}`).set(headers)).status).toBe(404)
})

test('a job of another person and a pool job cannot be deleted', async () => {
  const ben = await otherUser()
  const own = (await request(app).post('/api/v1/jobs').set(ben.headers).send(OWN_JOB)).body as { id: number }
  const pool = await prisma.job.create({
    data: {
      source: 'ba',
      externalId: 'pool-1',
      title: 'Pool-Stelle',
      city: 'Berlin',
      description: 'Text',
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })

  expect((await request(app).delete(`/api/v1/jobs/${own.id}`).set(headers)).status).toBe(404)
  expect((await request(app).delete(`/api/v1/jobs/${pool.id}`).set(headers)).status).toBe(404)
  expect((await request(app).delete(`/api/v1/jobs/${pool.id}`)).status).toBe(401)
  expect(await prisma.job.count()).toBe(2)
})

test('deleting the account deletes its own jobs', async () => {
  await request(app).post('/api/v1/jobs').set(headers).send(OWN_JOB)

  await prisma.user.delete({ where: { id: annaId } })

  expect(await prisma.job.count()).toBe(0)
})
