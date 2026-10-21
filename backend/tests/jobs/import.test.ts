import { readFileSync } from 'node:fs'
import { beforeEach, expect, test } from 'vitest'
import { BA_PAGE_SIZE } from '../../src/modules/jobs/jobs.ba.js'
import { JobsService } from '../../src/modules/jobs/jobs.service.js'
import { useTestDatabase } from '../helpers.js'

const { prisma, ba, messages } = useTestDatabase()
const service = new JobsService(prisma, ba.client, messages.send)

const NOW = new Date('2026-10-17T06:00:00Z')

function fixture(name: string): { ergebnisliste: Record<string, unknown>[] } & Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8')) as never
}

const FRONTEND = fixture('search-frontend')
const BACKEND = fixture('search-backend')
const DETAILS = fixture('details')

const IMPORTED = ['10001-1000000001-S', '10001-1000000004-S', '10001-1000000006-S']

beforeEach(() => {
  ba.searches.set('Frontend:1', FRONTEND)
  ba.searches.set('Backend:1', BACKEND)
  for (const id of [...IMPORTED, '10001-1000000003-S']) ba.details.set(id, DETAILS)
})

function detailRequests(): string[] {
  return ba.requests.filter(({ url }) => url.pathname.includes('/jobdetails/')).map(({ url }) => url.pathname)
}

test('German jobs of the last 30 days are stored with offer type', async () => {
  const summary = await service.importPool(NOW)

  expect(summary).toEqual({ imported: 3, duplicates: 1, filtered: 2, failed: 2 })
  const jobs = await prisma.job.findMany({ orderBy: { externalId: 'asc' } })
  expect(jobs.map((job) => job.externalId)).toEqual(IMPORTED)
  expect(jobs[0]).toMatchObject({
    source: 'ba',
    title: 'Frontend-Entwicklerin (m/w/d)',
    company: 'Mediahaus GmbH',
    city: 'Berlin',
    region: 'BERLIN',
    offerType: 'work',
    role: 'Frontend',
    fullTime: true,
    partTime: false,
    description: DETAILS.stellenangebotsBeschreibung,
    publishedAt: new Date('2026-10-15'),
  })
  expect(jobs[1]).toMatchObject({ offerType: 'apprenticeship', company: null, city: 'Leipzig', fullTime: false, partTime: true })
  expect(jobs[2]).toMatchObject({ offerType: 'internship', role: 'Backend', city: 'München' })
})

test('jobs outside Germany and older than 30 days are not fetched', async () => {
  await service.importPool(NOW)

  expect(detailRequests()).not.toContainEqual(expect.stringContaining(btoa('10001-1000000002-S')))
  expect(detailRequests()).not.toContainEqual(expect.stringContaining(btoa('10001-1000000003-S')))
  expect(await prisma.job.count({ where: { externalId: { in: ['10001-1000000002-S', '10001-1000000003-S'] } } })).toBe(0)
})

test('a job found by two search terms is stored once with the first role', async () => {
  await service.importPool(NOW)

  const job = await prisma.job.findFirstOrThrow({ where: { externalId: '10001-1000000001-S' } })
  expect(job.role).toBe('Frontend')
  expect(detailRequests().filter((path) => path.endsWith(btoa('10001-1000000001-S')))).toHaveLength(1)
})

test('a second import skips known jobs without fetching them again', async () => {
  await service.importPool(NOW)
  ba.requests.length = 0

  const summary = await service.importPool(NOW)

  expect(summary).toEqual({ imported: 0, duplicates: 4, filtered: 2, failed: 2 })
  expect(await prisma.job.count()).toBe(3)
  expect(detailRequests()).toHaveLength(1)
  expect(await prisma.jobImport.count()).toBe(2)
})

test('an import run is recorded with its counts', async () => {
  await service.importPool(NOW)

  const run = await prisma.jobImport.findFirstOrThrow()
  expect(run).toMatchObject({ imported: 3, duplicates: 1, filtered: 2, failed: 2 })
})

test('a job without description and a broken entry count as failed, the rest is imported', async () => {
  const summary = await service.importPool(NOW)

  expect(summary.failed).toBe(2)
  expect(await prisma.job.count({ where: { externalId: '10001-1000000005-S' } })).toBe(0)
})

test('the search asks for the newest jobs of the last 30 days with the API key', async () => {
  await service.importPool(NOW)

  const search = ba.requests.find(({ url }) => url.searchParams.get('was') === 'Frontend')!
  expect(search.url.origin + search.url.pathname).toBe(
    'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs',
  )
  expect(Object.fromEntries(search.url.searchParams)).toMatchObject({
    page: '1',
    size: String(BA_PAGE_SIZE),
    veroeffentlichtseit: '30',
    sort: 'veroeffdatum',
  })
  expect(search.headers).toEqual({ 'X-API-Key': 'jobboerse-jobsuche' })
  expect(detailRequests()).toContain(`/jobboerse/jobsuche-service/pc/v4/jobdetails/${encodeURIComponent(btoa('10001-1000000001-S'))}`)
})

test('a full page loads the next page, at most two', async () => {
  const full = { ergebnisliste: Array.from({ length: BA_PAGE_SIZE }, () => ({})) }
  ba.searches.set('Frontend:1', full)
  ba.searches.set('Frontend:2', full)

  await service.importPool(NOW)

  const pages = ba.requests.filter(({ url }) => url.searchParams.get('was') === 'Frontend').map(({ url }) => url.searchParams.get('page'))
  expect(pages).toEqual(['1', '2'])
})

test('when the Bundesagentur is down nothing is stored and the run is recorded', async () => {
  ba.down = true

  const summary = await service.importPool(NOW)

  expect(summary.imported).toBe(0)
  expect(summary.failed).toBeGreaterThan(0)
  expect(await prisma.job.count()).toBe(0)
  expect(await prisma.jobImport.count()).toBe(1)
})

test('empty bullets of the Bundesagentur text are joined with their line', async () => {
  ba.details.set('10001-1000000001-S', {
    stellenangebotsBeschreibung: '### Senior Backend Developer\n\n- \nFull or Part Time\n- \n\n Hybrid\n\n- \n\nDresden\n\n- \n \n\n### Your role\n \n\nC++ und Linux',
  })

  await service.importPool(NOW)

  const job = await prisma.job.findFirstOrThrow({ where: { externalId: '10001-1000000001-S' } })
  expect(job.description).toBe(
    '### Senior Backend Developer\n\n- Full or Part Time\n- Hybrid\n\n- Dresden\n\n### Your role\n\nC++ und Linux',
  )
})
