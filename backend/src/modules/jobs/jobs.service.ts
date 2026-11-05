import { randomUUID } from 'node:crypto'
import type { Job, OfferType, Prisma, PrismaClient } from '../../generated/prisma/client.js'
import type { SendMessage, SendResult } from '../../llm/send.js'
import { CV_ROLES, type CvRole } from '../../prompts/cv_analysis.js'
import {
  jobExtractRequest,
  jobExtractResult,
  jobExtractSchema,
  type JobExtract,
  type JobExtractInput,
} from '../../prompts/job_extract.js'
import { BA_MAX_PAGES, BA_PAGE_SIZE, BA_SEARCH_TERMS, POOL_DAYS, type BaClient } from './jobs.ba.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import {
  REGIONS,
  baJobSchema,
  type BaJob,
  type JobReading,
  type JobsQuery,
  type OwnJobInput,
  type Region,
} from './jobs.schemas.js'

export type ImportSummary = { imported: number; duplicates: number; filtered: number; failed: number }

export type JobList = { total: number; jobs: Job[]; poolUpdatedAt: Date | null }

type Outcome = keyof ImportSummary

const DAY_MS = 24 * 60 * 60 * 1000

const OWN_JOB_ROLE: CvRole = 'Andere'

export const JOB_READINGS_PER_DAY = 20

const OFFER_TYPES: Record<BaJob['stellenangebotsart'], OfferType> = {
  ARBEIT: 'work',
  SELBSTAENDIGKEIT: 'self_employment',
  AUSBILDUNG: 'apprenticeship',
  PRAKTIKUM_TRAINEE: 'internship',
}

export class JobsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ba: BaClient,
    private readonly sendMessage: SendMessage,
  ) { }

  async importPool(now = new Date()): Promise<ImportSummary> {
    const since = new Date(now.getTime() - POOL_DAYS * DAY_MS).toISOString().slice(0, 10)
    const summary: ImportSummary = { imported: 0, duplicates: 0, filtered: 0, failed: 0 }
    for (const role of CV_ROLES) {
      for (const term of BA_SEARCH_TERMS[role]) {
        for (let page = 1; page <= BA_MAX_PAGES; page++) {
          let items: unknown[]
          try {
            items = await this.ba.search(term, page)
          } catch (error) {
            console.error(error)
            summary.failed += 1
            break
          }
          const jobs = items.flatMap((item) => {
            const parsed = baJobSchema.safeParse(item)
            return parsed.success ? [parsed.data] : []
          })
          summary.failed += items.length - jobs.length
          const stored = await this.prisma.job.findMany({
            where: { source: 'ba', externalId: { in: jobs.map((job) => job.referenznummer) } },
            select: { externalId: true },
          })
          const known = new Set(stored.map((job) => job.externalId))
          for (const job of jobs) summary[await this.importOne(job, role, since, known)] += 1
          if (items.length < BA_PAGE_SIZE) break
        }
      }
    }
    await this.prisma.jobImport.create({ data: summary })
    return summary
  }

  async list(userId: number, query: JobsQuery, now = new Date()): Promise<JobList> {
    const pool: Prisma.JobWhereInput = {
      source: 'ba',
      publishedAt: { gte: new Date(new Date(now.getTime() - POOL_DAYS * DAY_MS).toISOString().slice(0, 10)) },
      role: query.role,
      region: query.region,
    }
    const own: Prisma.JobWhereInput = { source: 'own', userId }
    const where: Prisma.JobWhereInput = {
      AND: [{ OR: query.source === 'ba' ? [pool] : query.source === 'own' ? [own] : [pool, own] }],
      fullTime: query.work_time === 'full' ? true : undefined,
      partTime: query.work_time === 'part' ? true : undefined,
      offerType: query.offer_type,
      OR: query.q
        ? [
          { title: { contains: query.q, mode: 'insensitive' } },
          { company: { contains: query.q, mode: 'insensitive' } },
          { city: { contains: query.q, mode: 'insensitive' } },
        ]
        : undefined,
    }
    const [total, jobs, lastImport] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.jobImport.findFirst({ orderBy: { id: 'desc' } }),
    ])
    return { total, jobs, poolUpdatedAt: lastImport?.createdAt ?? null }
  }

  async get(userId: number, id: number): Promise<Job> {
    const job = await this.prisma.job.findFirst({ where: { id, OR: [{ source: 'ba' }, { userId }] } })
    if (!job) throw new NotFoundError('Job not found')
    return job
  }

  visible(userId: number, ids: number[]): Promise<Job[]> {
    return this.prisma.job.findMany({ where: { id: { in: ids }, OR: [{ source: 'ba' }, { userId }] } })
  }

  async extract(userId: number, input: JobExtractInput, now = new Date()): Promise<JobReading> {
    await this.claimReading(userId, now)
    let result: SendResult
    try {
      result = await this.sendMessage(jobExtractRequest(input))
    } catch (error) {
      console.error(error)
      throw new AppError(502, 'extract_failed')
    }
    const output = parseExtract(result)
    if (!output) {
      console.warn(`job_extract: no valid output, stop reason ${result.stopReason}`)
      throw new AppError(502, 'extract_failed')
    }
    const { draft, suspiciousText, unverified, hits } = jobExtractResult(output, input)
    if (hits || suspiciousText.length) {
      console.warn(`job_extract: ${hits} check hits, ${suspiciousText.length} suspicious passages`)
    }
    if (!output.is_job) throw new AppError(422, 'not_job')
    return { ...draft, suspicious_text: suspiciousText, unverified }
  }

  create(userId: number, input: OwnJobInput, now = new Date()): Promise<Job> {
    return this.prisma.job.create({
      data: {
        source: 'own',
        userId,
        externalId: randomUUID(),
        title: input.title,
        company: input.company,
        city: input.city,
        description: input.description,
        offerType: input.offer_type,
        role: OWN_JOB_ROLE,
        fullTime: input.full_time,
        partTime: input.part_time,
        salary: input.salary,
        publishedAt: new Date(now.toISOString().slice(0, 10)),
      },
    })
  }

  async remove(userId: number, id: number): Promise<void> {
    const { count } = await this.prisma.job.deleteMany({ where: { id, source: 'own', userId } })
    if (!count) throw new NotFoundError('Job not found')
  }

  private async claimReading(userId: number, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const today = await tx.extractRun.count({
        where: { userId, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
      })
      if (today >= JOB_READINGS_PER_DAY) throw new AppError(429, 'limit_reached')
      await tx.extractRun.create({ data: { userId, createdAt: now } })
    })
  }

  private async importOne(job: BaJob, role: CvRole, since: string, known: Set<string>): Promise<Outcome> {
    const location = job.stellenlokationen.find((entry) => entry.adresse.land === 'DEUTSCHLAND' && entry.adresse.ort)
    const publishedAt = job.veroeffentlichungszeitraum.von
    if (!location?.adresse.ort || publishedAt < since) return 'filtered'
    if (known.has(job.referenznummer)) return 'duplicates'
    known.add(job.referenznummer)
    let description: string
    try {
      description = await this.ba.description(job.referenznummer)
    } catch (error) {
      console.error(error)
      return 'failed'
    }
    const { count } = await this.prisma.job.createMany({
      data: {
        source: 'ba',
        externalId: job.referenznummer,
        title: job.stellenangebotsTitel.slice(0, 300),
        company: job.firma?.slice(0, 300) || null,
        city: location.adresse.ort.slice(0, 200),
        region: REGIONS.includes(location.adresse.region as Region) ? location.adresse.region : null,
        description,
        offerType: OFFER_TYPES[job.stellenangebotsart],
        role,
        fullTime: job.arbeitszeitVollzeit,
        partTime:
          job.arbeitszeitTeilzeitVormittag ||
          job.arbeitszeitTeilzeitNachmittag ||
          job.arbeitszeitTeilzeitAbend ||
          job.arbeitszeitTeilzeitFlexibel,
        publishedAt: new Date(publishedAt),
      },
      skipDuplicates: true,
    })
    return count ? 'imported' : 'duplicates'
  }
}

function parseExtract(result: SendResult): JobExtract | null {
  const text = result.content.find((block) => block.type === 'text')
  if (result.stopReason !== 'end_turn' || !text) return null
  try {
    const parsed = jobExtractSchema.safeParse(JSON.parse(text.text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
