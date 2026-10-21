import type { RequestHandler } from 'express'
import type { Job } from '../../generated/prisma/client.js'
import type { CvRole } from '../../prompts/cv_analysis.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  extractTextSchema,
  jobIdSchema,
  jobsQuerySchema,
  ownJobSchema,
  screenshotSchema,
  type JobDetailOutput,
  type JobListOutput,
  type JobOutput,
  type Region,
} from './jobs.schemas.js'
import type { JobsService } from './jobs.service.js'

export class JobsController {
  constructor(private readonly jobs: JobsService) { }

  list: RequestHandler = async (req, res) => {
    const query = jobsQuerySchema.parse(req.query)
    const { total, jobs, poolUpdatedAt } = await this.jobs.list(authOf(req).user.id, query)
    const body: JobListOutput = { total, pool_updated_at: poolUpdatedAt, jobs: jobs.map(output) }
    res.json(body)
  }

  show: RequestHandler = async (req, res) => {
    const job = await this.jobs.get(authOf(req).user.id, jobIdSchema.parse(req.params.id))
    res.json(detail(job))
  }

  extract: RequestHandler = async (req, res) => {
    const input = Buffer.isBuffer(req.body)
      ? screenshotSchema.parse(req.body)
      : { kind: 'text' as const, ...extractTextSchema.parse(req.body) }
    res.json(await this.jobs.extract(input))
  }

  create: RequestHandler = async (req, res) => {
    const input = ownJobSchema.parse(req.body)
    const job = await this.jobs.create(authOf(req).user.id, input)
    res.status(201).json(detail(job))
  }
}

function output(job: Job): JobOutput {
  return {
    id: job.id,
    source: job.source,
    title: job.title,
    company: job.company,
    city: job.city,
    region: job.region as Region | null,
    offer_type: job.offerType,
    role: job.source === 'own' ? null : (job.role as CvRole),
    full_time: job.fullTime,
    part_time: job.partTime,
    published_at: job.publishedAt.toISOString().slice(0, 10),
  }
}

function detail(job: Job): JobDetailOutput {
  return {
    ...output(job),
    description: job.description,
    salary: job.salary,
    url: job.source === 'ba' ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.externalId}` : null,
  }
}
