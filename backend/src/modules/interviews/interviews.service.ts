import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { z } from 'zod'
import {
  Prisma,
  type InterviewSession,
  type InterviewTurn,
  type Job,
  type PrismaClient,
} from '../../generated/prisma/client.js'
import type { SendMessage, SendResult } from '../../llm/send.js'
import { interviewGradeRequest, interviewGradeSchema } from '../../prompts/interview_grade.js'
import {
  INTERVIEW_QUESTION_COUNTS,
  interviewQuestionRequest,
  interviewQuestionSchema,
  type InterviewDifficulty,
} from '../../prompts/interview_question.js'
import {
  INTERVIEW_REPORT_RECOMMENDATIONS_MAX,
  interviewReportRequest,
  interviewReportSchema,
  type InterviewReport,
} from '../../prompts/interview_report.js'
import { adText, type CoachMatch, type MatchAnalysis } from '../../prompts/match_analysis.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import { JOB_TEXT_MAX_CHARS } from '../jobs/jobs.schemas.js'
import type { JobsService } from '../jobs/jobs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import { INTERVIEW_LIMITS, type InterviewAreaOutput } from './interviews.schemas.js'

export const INTERVIEW_MAX_ATTEMPTS = 2
export const INTERVIEW_SESSIONS_PER_DAY = 3
export const INTERVIEW_TIMEOUT_MS = 120_000

const TURNS = { turns: { orderBy: { number: 'asc' as const } } }

export type InterviewDetail = InterviewSession & { job: Job; turns: InterviewTurn[]; matchScore: number | null }

export type InterviewStep = 'grade' | 'ask' | 'finish' | 'report'

export class InterviewsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sendMessage: SendMessage,
    private readonly jobs: JobsService,
    private readonly matches: MatchesService,
  ) { }

  async list(userId: number): Promise<InterviewDetail[]> {
    const sessions = await this.prisma.interviewSession.findMany({
      where: { userId },
      include: TURNS,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    const jobIds = [...new Set(sessions.map((session) => session.jobId))]
    const [jobs, scores] = await Promise.all([this.jobs.visible(userId, jobIds), this.matches.currentScores(userId, jobIds)])
    const byId = new Map(jobs.map((job) => [job.id, job]))
    return sessions.flatMap((session) => {
      const job = byId.get(session.jobId)
      return job ? [{ ...session, job, matchScore: scores.get(job.id) ?? null }] : []
    })
  }

  async get(userId: number, id: number): Promise<InterviewDetail> {
    const session = await this.prisma.interviewSession.findFirst({ where: { id, userId }, include: TURNS })
    if (!session) throw new NotFoundError()
    const job = await this.jobs.get(userId, session.jobId)
    const scores = await this.matches.currentScores(userId, [job.id])
    return { ...session, job, matchScore: scores.get(job.id) ?? null }
  }

  async start(userId: number, jobId: number, difficulty: InterviewDifficulty, now = new Date()): Promise<InterviewDetail> {
    await this.currentMatch(userId, jobId)
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const today = await tx.interviewSession.count({
        where: { userId, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
      })
      if (today >= INTERVIEW_SESSIONS_PER_DAY) throw new AppError(429, 'limit_reached')
      return tx.interviewSession.create({ data: { userId, jobId, difficulty, createdAt: now } })
    })
    try {
      return await this.advance(userId, session.id)
    } catch (error) {
      await this.prisma.interviewSession.delete({ where: { id: session.id } })
      throw error
    }
  }

  answer(userId: number, id: number, answer: string, now = new Date()): Promise<InterviewDetail> {
    return this.close(userId, id, { answer, answeredAt: now })
  }

  skip(userId: number, id: number, now = new Date()): Promise<InterviewDetail> {
    return this.close(userId, id, { skipped: true, answeredAt: now })
  }

  async resume(userId: number, id: number): Promise<InterviewDetail> {
    await this.get(userId, id)
    return this.advance(userId, id)
  }

  private async close(
    userId: number,
    id: number,
    data: Prisma.InterviewTurnUpdateManyMutationInput,
  ): Promise<InterviewDetail> {
    const session = await this.get(userId, id)
    const turn = session.turns.at(-1)
    const { count } =
      session.status === 'running' && turn
        ? await this.prisma.interviewTurn.updateMany({ where: { id: turn.id, answer: null, skipped: false }, data })
        : { count: 0 }
    if (!count) throw new AppError(409, 'no_open_question')
    return this.advance(userId, id)
  }

  private async advance(userId: number, id: number): Promise<InterviewDetail> {
    for (; ;) {
      const session = await this.get(userId, id)
      const step = nextStep(session)
      if (!step) return session
      if ((step === 'ask' || step === 'grade') && session.job.description.length > JOB_TEXT_MAX_CHARS) {
        console.warn(`Interview ${id}: description of ${session.job.description.length} characters cut in the prompt`)
      }
      if (step === 'grade') await this.grade(session, session.turns[session.turns.length - 1])
      else if (step === 'ask') await this.ask(userId, session)
      else if (step === 'report') await this.report(session)
      else {
        await this.prisma.interviewSession.updateMany({
          where: { id, status: 'running' },
          data: { status: 'finished', finishedAt: new Date() },
        })
      }
    }
  }

  private async ask(userId: number, session: InterviewDetail): Promise<void> {
    const { job, turns } = session
    const match = await this.currentMatch(userId, job.id)
    const params = interviewQuestionRequest({
      job,
      match,
      difficulty: session.difficulty,
      earlier: turns.map(({ question, gap }) => ({ question, gap })),
    })
    const question = await this.generate(session.id, params, (result) => parse(result, interviewQuestionSchema))
    const gap = match.gaps.find((entry) => question.gap !== null && collapse(entry.text) === collapse(question.gap))
    if (question.gap !== null && !gap) console.warn(`Interview ${session.id}: gap "${question.gap}" not in the match`)
    const quoted = question.ad_quote !== null && collapse(adText(job)).includes(collapse(question.ad_quote))
    if (question.ad_quote !== null && !quoted) {
      console.warn(`Interview ${session.id}: ad_quote "${question.ad_quote}" not in the ad`)
    }
    try {
      await this.prisma.interviewTurn.create({
        data: {
          sessionId: session.id,
          number: turns.length + 1,
          title: question.title.slice(0, INTERVIEW_LIMITS.title),
          question: question.question.slice(0, INTERVIEW_LIMITS.question),
          gap: gap?.text ?? null,
          adQuote: quoted ? question.ad_quote : null,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'busy')
      throw error
    }
  }

  private async grade(session: InterviewDetail, turn: InterviewTurn): Promise<void> {
    const params = interviewGradeRequest({
      job: session.job,
      question: turn.question,
      gap: turn.gap,
      answer: turn.answer ?? '',
    })
    const grade = await this.generate(session.id, params, (result) => parse(result, interviewGradeSchema))
    await this.prisma.interviewTurn.updateMany({
      where: { id: turn.id, score: null },
      data: {
        score: grade.score,
        good: grade.good && grade.good.slice(0, INTERVIEW_LIMITS.good),
        better: grade.better.slice(0, INTERVIEW_LIMITS.better),
      },
    })
  }

  private async report(session: InterviewDetail): Promise<void> {
    const { job, difficulty, turns } = session
    const graded = turns.flatMap((turn) => (turn.score !== null ? [turn.number] : []))
    const params = interviewReportRequest({
      job,
      difficulty,
      turns: turns.map(({ number, title, question, gap, answer, score, good, better }) => ({
        number,
        title,
        question,
        gap,
        answer,
        grade: score !== null && better !== null ? { score, good, better } : null,
      })),
    })
    const report = await this.generate(session.id, params, (result) => {
      const parsed = parse(result, interviewReportSchema)
      const numbers = parsed.turns.map((entry) => entry.number)
      if (numbers.length !== graded.length || graded.some((number) => !numbers.includes(number))) {
        throw new AppError(502, 'invalid_report')
      }
      return parsed
    })
    const data: InterviewReport = {
      turns: report.turns.map(({ number, area, line }) => ({
        number,
        area: area.slice(0, INTERVIEW_LIMITS.area),
        line: line.slice(0, INTERVIEW_LIMITS.line),
      })),
      recommendations: report.recommendations
        .slice(0, INTERVIEW_REPORT_RECOMMENDATIONS_MAX)
        .map((recommendation) => recommendation.slice(0, INTERVIEW_LIMITS.recommendation)),
    }
    await this.prisma.interviewSession.updateMany({
      where: { id: session.id, report: { equals: Prisma.DbNull } },
      data: { report: data },
    })
  }

  private async generate<T>(
    id: number,
    params: MessageCreateParamsNonStreaming,
    read: (result: SendResult) => T,
  ): Promise<T> {
    const signal = AbortSignal.timeout(INTERVIEW_TIMEOUT_MS)
    for (let attempt = 1; ; attempt++) {
      let result: SendResult
      try {
        result = await this.sendMessage(params, { signal })
      } catch (error) {
        console.error(error)
        throw signal.aborted ? new AppError(504, 'timeout') : new AppError(502, 'unavailable')
      }
      await this.prisma.interviewSession.update({
        where: { id },
        data: { inputTokens: { increment: result.inputTokens }, outputTokens: { increment: result.outputTokens } },
      })
      try {
        return read(result)
      } catch (error) {
        if (!(error instanceof AppError) || attempt >= INTERVIEW_MAX_ATTEMPTS) throw error
        console.warn(`Interview ${id}, attempt ${attempt}: ${error.message}`)
      }
    }
  }

  private async currentMatch(userId: number, jobId: number): Promise<CoachMatch> {
    const { current } = await this.matches.overview(userId, jobId)
    if (!current) throw new AppError(409, 'no_match')
    return {
      score: current.score,
      gaps: current.gaps as MatchAnalysis['gaps'],
      strengths: current.strengths as MatchAnalysis['strengths'],
      createdAt: current.createdAt,
    }
  }
}

export function nextStep({ status, difficulty, turns, report }: InterviewDetail): InterviewStep | null {
  const last = turns.at(-1)
  if (last && last.answer !== null && last.score === null) return 'grade'
  if (status === 'running') {
    if (last && last.answer === null && !last.skipped) return null
    return turns.length < INTERVIEW_QUESTION_COUNTS[difficulty] ? 'ask' : 'finish'
  }
  return report === null && turns.some((turn) => turn.score !== null) ? 'report' : null
}

export function reportSummary(
  turns: InterviewTurn[],
  report: InterviewReport,
): { score: number; strongest: InterviewAreaOutput; weakest: InterviewAreaOutput | null } {
  const scores = turns.flatMap((turn) => (turn.score !== null ? [turn.score] : []))
  const areas = new Map<string, number[]>()
  for (const entry of report.turns) {
    const score = turns.find((turn) => turn.number === entry.number)?.score
    if (score === null || score === undefined) continue
    const area = collapse(entry.area)
    areas.set(area, [...(areas.get(area) ?? []), score])
  }
  const ranked = [...areas].map(([area, values]) => ({
    area,
    average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
  }))
  ranked.sort((a, b) => b.average - a.average)
  const last = ranked[ranked.length - 1]
  return {
    score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
    strongest: ranked[0],
    weakest: last.average < ranked[0].average ? last : null,
  }
}

function parse<T>(result: SendResult, schema: z.ZodType<T>): T {
  if (result.stopReason === 'refusal') throw new AppError(502, 'refused')
  if (result.stopReason === 'max_tokens') throw new AppError(502, 'too_long')
  const text = result.content.find((block) => block.type === 'text')
  if (result.stopReason !== 'end_turn' || !text) throw new AppError(502, 'invalid_output')
  let json: unknown
  try {
    json = JSON.parse(text.text)
  } catch {
    throw new AppError(502, 'invalid_output')
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new AppError(502, 'invalid_output')
  return parsed.data
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
