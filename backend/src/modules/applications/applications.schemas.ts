import { z } from 'zod'
import type { JOB_SOURCES, OFFER_TYPES } from '../jobs/jobs.schemas.js'

export const APPLICATION_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const NOTE_MAX_CHARS = 5000

export const applicationIdSchema = z.coerce.number().int().positive()

export const createApplicationSchema = z.object({ job_id: z.int().positive() })

export const statusSchema = z.object({ status: z.enum(APPLICATION_STATUSES) })

export const noteSchema = z.object({ content: z.string().trim().min(1).max(NOTE_MAX_CHARS) })

type JobSummary = {
  id: number
  source: (typeof JOB_SOURCES)[number]
  title: string
  company: string | null
  city: string
}

export type NoteOutput = { id: number; content: string; created_at: Date }

export type ApplicationListItemOutput = {
  id: number
  status: ApplicationStatus
  created_at: Date
  applied_at: Date | null
  changed_at: Date
  notes: number
  match_score: number | null
  job: JobSummary
}

export type ApplicationOutput = {
  id: number
  status: ApplicationStatus
  created_at: Date
  match_score: number | null
  job: JobSummary & { offer_type: (typeof OFFER_TYPES)[number]; full_time: boolean; part_time: boolean }
  history: { status: ApplicationStatus; changed_at: Date }[]
  notes: NoteOutput[]
}
