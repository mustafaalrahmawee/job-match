import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import { JOB_EXTRACT_MODEL } from '../../src/prompts/job_extract.js'
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
  return (message.content as ContentBlockParam[])[0]
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
  })
  expect(messages.requests).toHaveLength(1)
  expect(messages.requests[0].model).toBe(JOB_EXTRACT_MODEL)
  expect(material()).toMatchObject({ type: 'document', source: { type: 'text', data: AD } })
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

test('deleting the account deletes its own jobs', async () => {
  await request(app).post('/api/v1/jobs').set(headers).send(OWN_JOB)

  await prisma.user.delete({ where: { id: annaId } })

  expect(await prisma.job.count()).toBe(0)
})
