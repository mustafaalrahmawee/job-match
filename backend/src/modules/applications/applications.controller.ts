import type { RequestHandler } from 'express'
import type { Job, Note } from '../../generated/prisma/client.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  applicationIdSchema,
  createApplicationSchema,
  noteSchema,
  statusSchema,
  type ApplicationListItemOutput,
  type ApplicationOutput,
  type NoteOutput,
} from './applications.schemas.js'
import type { ApplicationDetail, ApplicationsService } from './applications.service.js'

export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) { }

  list: RequestHandler = async (req, res) => {
    const applications = await this.applications.list(authOf(req).user.id)
    const body: ApplicationListItemOutput[] = applications.map((application) => ({
      id: application.id,
      status: application.status,
      created_at: application.createdAt,
      applied_at: application.appliedAt,
      changed_at: application.changedAt,
      notes: application.notes,
      match_score: application.matchScore,
      job: job(application.job),
    }))
    res.json(body)
  }

  show: RequestHandler = async (req, res) => {
    const application = await this.applications.get(authOf(req).user.id, applicationIdSchema.parse(req.params.id))
    res.json(output(application))
  }

  create: RequestHandler = async (req, res) => {
    const { job_id } = createApplicationSchema.parse(req.body)
    const application = await this.applications.create(authOf(req).user.id, job_id)
    res.status(201).json(output(application))
  }

  setStatus: RequestHandler = async (req, res) => {
    const id = applicationIdSchema.parse(req.params.id)
    const { status } = statusSchema.parse(req.body)
    const application = await this.applications.setStatus(authOf(req).user.id, id, status)
    res.json(output(application))
  }

  addNote: RequestHandler = async (req, res) => {
    const id = applicationIdSchema.parse(req.params.id)
    const { content } = noteSchema.parse(req.body)
    const note = await this.applications.addNote(authOf(req).user.id, id, content)
    res.status(201).json(noteOutput(note))
  }
}

function job(job: Job): ApplicationListItemOutput['job'] {
  return { id: job.id, source: job.source, title: job.title, company: job.company, city: job.city }
}

function noteOutput(note: Note): NoteOutput {
  return { id: note.id, content: note.content, created_at: note.createdAt }
}

function output(application: ApplicationDetail): ApplicationOutput {
  return {
    id: application.id,
    status: application.status,
    created_at: application.createdAt,
    match_score: application.matchScore,
    job: {
      ...job(application.job),
      offer_type: application.job.offerType,
      full_time: application.job.fullTime,
      part_time: application.job.partTime,
    },
    history: application.statusChanges.map((change) => ({ status: change.status, changed_at: change.changedAt })),
    notes: application.notes.map(noteOutput),
  }
}
