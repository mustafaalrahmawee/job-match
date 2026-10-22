import { Prisma, type Application, type Job, type Note, type PrismaClient, type StatusChange } from '../../generated/prisma/client.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import type { JobsService } from '../jobs/jobs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import type { ApplicationStatus } from './applications.schemas.js'

const HISTORY = { orderBy: [{ changedAt: 'desc' as const }, { id: 'desc' as const }] }

export type ApplicationSummary = Application & {
  job: Job
  matchScore: number | null
  appliedAt: Date | null
  changedAt: Date
  notes: number
}

export type ApplicationDetail = Application & {
  job: Job
  matchScore: number | null
  statusChanges: StatusChange[]
  notes: Note[]
}

export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly jobs: JobsService,
    private readonly matches: MatchesService,
  ) { }

  async list(userId: number): Promise<ApplicationSummary[]> {
    const applications = await this.prisma.application.findMany({
      where: { userId },
      include: { statusChanges: HISTORY, _count: { select: { notes: true } } },
    })
    const jobIds = applications.map((application) => application.jobId)
    const [jobs, scores] = await Promise.all([this.jobs.visible(userId, jobIds), this.matches.currentScores(userId, jobIds)])
    const byId = new Map(jobs.map((job) => [job.id, job]))
    return applications
      .flatMap(({ statusChanges, _count, ...application }) => {
        const job = byId.get(application.jobId)
        if (!job) return []
        return [
          {
            ...application,
            job,
            matchScore: scores.get(job.id) ?? null,
            appliedAt: statusChanges.findLast((change) => change.status === 'applied')?.changedAt ?? null,
            changedAt: statusChanges[0]?.changedAt ?? application.createdAt,
            notes: _count.notes,
          },
        ]
      })
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime() || b.id - a.id)
  }

  async get(userId: number, id: number): Promise<ApplicationDetail> {
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: { statusChanges: HISTORY, notes: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } },
    })
    if (!application) throw new NotFoundError('Application not found')
    const [job, scores] = await Promise.all([
      this.jobs.get(userId, application.jobId),
      this.matches.currentScores(userId, [application.jobId]),
    ])
    return { ...application, job, matchScore: scores.get(job.id) ?? null }
  }

  async create(userId: number, jobId: number, now = new Date()): Promise<ApplicationDetail> {
    await this.jobs.get(userId, jobId)
    let application: Application
    try {
      application = await this.prisma.application.create({
        data: { userId, jobId, createdAt: now, statusChanges: { create: { status: 'saved', changedAt: now } } },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'exists')
      }
      throw error
    }
    return this.get(userId, application.id)
  }

  async setStatus(userId: number, id: number, status: ApplicationStatus, now = new Date()): Promise<ApplicationDetail> {
    await this.prisma.$transaction(async (tx) => {
      const application = await tx.application.findFirst({ where: { id, userId }, select: { id: true } })
      if (!application) throw new NotFoundError('Application not found')
      const changed = await tx.application.updateMany({ where: { id, status: { not: status } }, data: { status } })
      if (changed.count) await tx.statusChange.create({ data: { applicationId: id, status, changedAt: now } })
    })
    return this.get(userId, id)
  }

  async addNote(userId: number, id: number, content: string): Promise<Note> {
    const application = await this.prisma.application.findFirst({ where: { id, userId }, select: { id: true } })
    if (!application) throw new NotFoundError('Application not found')
    return this.prisma.note.create({ data: { applicationId: id, content } })
  }
}
