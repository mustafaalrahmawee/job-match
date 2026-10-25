import { z } from 'zod'
import { INTERVIEW_ANSWER_MAX_CHARS } from '../../prompts/interview_grade.js'
import { INTERVIEW_DIFFICULTIES, type InterviewDifficulty } from '../../prompts/interview_question.js'
import type { JOB_SOURCES } from '../jobs/jobs.schemas.js'

export const INTERVIEW_LIMITS = {
  title: 200,
  question: 2000,
  good: 1000,
  better: 1000,
  area: 100,
  line: 500,
  recommendation: 500,
} as const

export const interviewIdSchema = z.coerce.number().int().positive()

export const startInterviewSchema = z.object({
  job_id: z.int().positive(),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES),
})

export const answerSchema = z.object({
  answer: z
    .string()
    .max(INTERVIEW_ANSWER_MAX_CHARS)
    .refine((answer) => answer.trim() !== ''),
})

export type InterviewTurnOutput = {
  number: number
  title: string
  question: string
  gap: string | null
  ad_quote: string | null
  answer: string | null
  skipped: boolean
  score: number | null
  good: string | null
  better: string | null
  area: string | null
  line: string | null
}

export type InterviewAreaOutput = { area: string; average: number }

export type InterviewReportOutput = {
  score: number
  strongest: InterviewAreaOutput
  weakest: InterviewAreaOutput | null
  recommendations: string[]
}

export type InterviewOutput = {
  id: number
  job: { id: number; source: (typeof JOB_SOURCES)[number]; title: string; company: string | null; city: string }
  difficulty: InterviewDifficulty
  status: 'running' | 'finished'
  question_count: number
  pending: boolean
  match_score: number | null
  created_at: Date
  updated_at: Date
  finished_at: Date | null
  turns: InterviewTurnOutput[]
  report: InterviewReportOutput | null
}
