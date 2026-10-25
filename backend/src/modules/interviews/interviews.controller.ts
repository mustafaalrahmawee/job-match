import type { RequestHandler } from 'express'
import { INTERVIEW_QUESTION_COUNTS } from '../../prompts/interview_question.js'
import type { InterviewReport } from '../../prompts/interview_report.js'
import { authOf } from '../../shared/auth.middleware.js'
import { answerSchema, interviewIdSchema, startInterviewSchema, type InterviewOutput } from './interviews.schemas.js'
import { nextStep, reportSummary, type InterviewDetail, type InterviewsService } from './interviews.service.js'

export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) { }

  list: RequestHandler = async (req, res) => {
    const sessions = await this.interviews.list(authOf(req).user.id)
    res.json(sessions.map(output))
  }

  show: RequestHandler = async (req, res) => {
    const id = interviewIdSchema.parse(req.params.id)
    res.json(output(await this.interviews.get(authOf(req).user.id, id)))
  }

  start: RequestHandler = async (req, res) => {
    const { job_id, difficulty } = startInterviewSchema.parse(req.body)
    const session = await this.interviews.start(authOf(req).user.id, job_id, difficulty)
    res.status(201).json(output(session))
  }

  answer: RequestHandler = async (req, res) => {
    const id = interviewIdSchema.parse(req.params.id)
    const { answer } = answerSchema.parse(req.body)
    res.json(output(await this.interviews.answer(authOf(req).user.id, id, answer)))
  }

  skip: RequestHandler = async (req, res) => {
    const id = interviewIdSchema.parse(req.params.id)
    res.json(output(await this.interviews.skip(authOf(req).user.id, id)))
  }

  resume: RequestHandler = async (req, res) => {
    const id = interviewIdSchema.parse(req.params.id)
    res.json(output(await this.interviews.resume(authOf(req).user.id, id)))
  }
}

function output(session: InterviewDetail): InterviewOutput {
  const report = session.report as InterviewReport | null
  return {
    id: session.id,
    job: {
      id: session.job.id,
      source: session.job.source,
      title: session.job.title,
      company: session.job.company,
      city: session.job.city,
    },
    difficulty: session.difficulty,
    status: session.status,
    question_count: INTERVIEW_QUESTION_COUNTS[session.difficulty],
    pending: nextStep(session) !== null,
    match_score: session.matchScore,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    finished_at: session.finishedAt,
    turns: session.turns.map((turn) => {
      const entry = report?.turns.find((item) => item.number === turn.number)
      return {
        number: turn.number,
        title: turn.title,
        question: turn.question,
        gap: turn.gap,
        ad_quote: turn.adQuote,
        answer: turn.answer,
        skipped: turn.skipped,
        score: turn.score,
        good: turn.good,
        better: turn.better,
        area: entry?.area ?? null,
        line: entry?.line ?? null,
      }
    }),
    report: report && { ...reportSummary(session.turns, report), recommendations: report.recommendations },
  }
}
