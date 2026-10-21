import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Job, MatchResult, MatchRun, PrismaClient } from '../../generated/prisma/client.js'
import type { SendMessage, SendResult } from '../../llm/send.js'
import { cvAside, type CoachCv } from '../../prompts/coach_chat.js'
import {
  MATCH_CV_SECTIONS,
  MATCH_LIST_LIMITS,
  adText,
  matchAnalysisRequest,
  matchAnalysisSchema,
  type MatchAnalysis,
} from '../../prompts/match_analysis.js'
import { AppError } from '../../shared/errors.js'
import type { CvsService } from '../cvs/cvs.service.js'
import { JOB_TEXT_MAX_CHARS } from '../jobs/jobs.schemas.js'
import type { JobsService } from '../jobs/jobs.service.js'

export const MATCH_MAX_ATTEMPTS = 2
export const MATCH_RUNS_PER_DAY = 5
export const MATCH_TIMEOUT_MS = 120_000

const VERSION = { cvVersion: { select: { isActive: true, role: true, createdAt: true } } } as const

export type MatchResultInfo = MatchResult & { cvVersion: { isActive: boolean; role: string | null; createdAt: Date } }

export type MatchOverview = { current: MatchResultInfo | null; archived: MatchResultInfo[] }

export type MatchWithJob = MatchResultInfo & { job: Job }

export class MatchesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sendMessage: SendMessage,
    private readonly cvs: CvsService,
    private readonly jobs: JobsService,
  ) { }

  async list(userId: number): Promise<MatchWithJob[]> {
    const results = await this.prisma.matchResult.findMany({
      where: { userId, cvVersion: { isActive: true } },
      include: VERSION,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    })
    const jobs = new Map(
      (await this.jobs.visible(userId, results.map((result) => result.jobId))).map((job) => [job.id, job]),
    )
    return results.flatMap((result) => {
      const job = jobs.get(result.jobId)
      return job ? [{ ...result, job }] : []
    })
  }

  async overview(userId: number, jobId: number): Promise<MatchOverview> {
    await this.jobs.get(userId, jobId)
    const results = await this.prisma.matchResult.findMany({
      where: { userId, jobId },
      include: VERSION,
      orderBy: { createdAt: 'desc' },
    })
    return {
      current: results.find((result) => result.cvVersion.isActive) ?? null,
      archived: results.filter((result) => !result.cvVersion.isActive),
    }
  }

  async run(userId: number, jobId: number, now = new Date()): Promise<MatchResultInfo> {
    const job = await this.jobs.get(userId, jobId)
    const ready = await this.cvs.readyAnalysis(userId)
    if (!ready) throw new AppError(409, 'no_cv')
    const cv: CoachCv = { role: ready.role, analysis: ready.analysis, asOf: now.toISOString().slice(0, 10) }
    const params = matchAnalysisRequest(cv, job)
    const run = await this.start(userId, jobId, params, now)
    if (job.description.length > JOB_TEXT_MAX_CHARS) {
      console.warn(`Match for job ${job.id}: description of ${job.description.length} characters cut in the prompt`)
    }
    const usage = { inputTokens: 0, outputTokens: 0 }
    const signal = AbortSignal.timeout(MATCH_TIMEOUT_MS)
    try {
      for (let attempt = 1; ; attempt++) {
        let result: SendResult
        try {
          result = await this.sendMessage(params, { signal })
        } catch (error) {
          console.error(error)
          throw signal.aborted ? new AppError(504, 'timeout') : new AppError(502, 'unavailable')
        }
        usage.inputTokens += result.inputTokens
        usage.outputTokens += result.outputTokens
        const analysis = parse(result)
        const missing = missingQuotes(analysis, cv, job)
        if (!missing.length) {
          const data = { score: analysis.score, strengths: analysis.strengths, gaps: analysis.gaps, tips: analysis.tips }
          const [saved] = await this.prisma.$transaction([
            this.prisma.matchResult.upsert({
              where: { cvVersionId_jobId: { cvVersionId: ready.id, jobId } },
              create: { userId, cvVersionId: ready.id, jobId, ...data },
              update: { ...data, createdAt: new Date() },
              include: VERSION,
            }),
            this.prisma.matchRun.update({ where: { id: run.id }, data: { ...usage, status: 'ready' } }),
          ])
          return saved
        }
        for (const quote of missing) console.warn(`Match for job ${job.id}, attempt ${attempt}: ${quote}`)
        if (attempt >= MATCH_MAX_ATTEMPTS) throw new AppError(502, 'quotes_not_found')
      }
    } catch (error) {
      await this.prisma.matchRun.updateMany({ where: { id: run.id }, data: { ...usage, status: 'failed' } })
      throw error
    }
  }

  private start(userId: number, jobId: number, params: MessageCreateParamsNonStreaming, now: Date): Promise<MatchRun> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const today = await tx.matchRun.count({
        where: { userId, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
      })
      if (today >= MATCH_RUNS_PER_DAY) throw new AppError(429, 'limit_reached')
      const running = await tx.matchRun.count({
        where: { userId, jobId, status: 'running', createdAt: { gt: new Date(now.getTime() - MATCH_TIMEOUT_MS) } },
      })
      if (running) throw new AppError(409, 'running')
      return tx.matchRun.create({
        data: { userId, jobId, model: params.model, effort: params.output_config?.effort, createdAt: now },
      })
    })
  }
}

function parse(result: SendResult): MatchAnalysis {
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
  const parsed = matchAnalysisSchema.safeParse(json)
  if (!parsed.success) throw new AppError(502, 'invalid_output')
  return {
    score: parsed.data.score,
    gaps: parsed.data.gaps.slice(0, MATCH_LIST_LIMITS.gaps),
    strengths: parsed.data.strengths.slice(0, MATCH_LIST_LIMITS.strengths),
    tips: parsed.data.tips.slice(0, MATCH_LIST_LIMITS.tips),
  }
}

function missingQuotes(analysis: MatchAnalysis, cv: CoachCv, job: Job): string[] {
  const ad = collapse(adText(job))
  const lines = cvAside(cv, MATCH_CV_SECTIONS)
    .split('\n')
    .filter((line) => line.startsWith('- ') && line !== '- keine Angabe')
    .map((line) => collapse(line.slice(2)))
  return [...analysis.gaps, ...analysis.strengths, ...analysis.tips].flatMap(({ ad_quote, cv_quote }) => [
    ...(ad_quote !== null && !ad.includes(collapse(ad_quote)) ? [`ad_quote "${ad_quote}" not in the ad`] : []),
    ...(cv_quote !== null && !lines.some((line) => line.includes(collapse(cv_quote)))
      ? [`cv_quote "${cv_quote}" not in the CV section`]
      : []),
  ])
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
