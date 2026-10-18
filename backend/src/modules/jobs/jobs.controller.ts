import type { RequestHandler } from 'express'
import type { Job } from '../../generated/prisma/client.js'
import type { CvRole } from '../../prompts/cv_analysis.js'
import {
  jobIdSchema,
  jobsQuerySchema,
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
    const { total, jobs, poolUpdatedAt } = await this.jobs.list(query)
    const body: JobListOutput = { total, pool_updated_at: poolUpdatedAt, jobs: jobs.map(output) }
    res.json(body)
  }

  show: RequestHandler = async (req, res) => {
    const job = await this.jobs.get(jobIdSchema.parse(req.params.id))
    const body: JobDetailOutput = {
      ...output(job),
      description: job.description,
      url: job.source === 'ba' ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${job.externalId}` : null,
    }
    res.json(body)
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
    role: job.role as CvRole,
    full_time: job.fullTime,
    part_time: job.partTime,
    published_at: job.publishedAt.toISOString().slice(0, 10),
  }
}
