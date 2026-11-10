import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Job, LlmRun, MatchResult, PrismaClient } from '../../generated/prisma/client.js'
import { structuredOutput, type SendMessage, type SendResult } from '../../llm/send.js'
import type { CoachCv } from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import { matchAnalysisRequest } from '../../prompts/match_analysis/match_analysis.request.js'
import { matchAnalysisResult, missingFacts, missingQuotes } from '../../prompts/match_analysis/match_analysis.result.js'
import { matchAnalysisSchema } from '../../prompts/match_analysis/match_analysis.schemas.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import { claimRun } from '../../shared/runs.js'
import type { CvsService } from '../cvs/cvs.service.js'
import { JOB_TEXT_MAX_CHARS } from '../jobs/jobs.schemas.js'
import type { JobsService } from '../jobs/jobs.service.js'

export const MATCH_MAX_ATTEMPTS = 2
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

  async currentScores(userId: number, jobIds: number[]): Promise<Map<number, number>> {
    const results = await this.prisma.matchResult.findMany({
      where: { userId, jobId: { in: jobIds }, cvVersion: { isActive: true } },
      select: { jobId: true, score: true },
    })
    return new Map(results.map((result) => [result.jobId, result.score]))
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
        const output = structuredOutput(result, matchAnalysisSchema)
        if ('error' in output) throw new AppError(502, output.error)
        const { analysis, suspiciousText, hits } = matchAnalysisResult(output.data)
        if (hits || suspiciousText.length) {
          console.warn(`Match for job ${job.id}, attempt ${attempt}: ${hits} check hits, ${suspiciousText.length} suspicious passages`)
        }
        const missing = missingQuotes(analysis, cv, job) + missingFacts(analysis, cv, job)
        if (!missing) {
          const data = { ...analysis, suspiciousText, createdAt: new Date() }
          const [saved] = await this.prisma.$transaction([
            this.prisma.matchResult.upsert({
              where: { cvVersionId_jobId: { cvVersionId: ready.id, jobId } },
              create: { userId, cvVersionId: ready.id, jobId, ...data },
              update: { ...data, confirmedAt: null },
              include: VERSION,
            }),
            this.prisma.llmRun.update({ where: { id: run.id }, data: { ...usage, status: 'ready' } }),
          ])
          return saved
        }
        console.warn(`Match for job ${job.id}, attempt ${attempt}: ${missing} quotes or facts not found`)
        if (attempt >= MATCH_MAX_ATTEMPTS) throw new AppError(502, 'quotes_not_found')
      }
    } catch (error) {
      if (error instanceof AppError) console.warn(`Match for job ${job.id}: ${error.message}`)
      await this.prisma.llmRun.updateMany({ where: { id: run.id }, data: { ...usage, status: 'failed' } })
      throw error
    }
  }

  async confirm(userId: number, id: number, createdAt: Date, now = new Date()): Promise<MatchResultInfo> {
    const { count } = await this.prisma.matchResult.updateMany({
      where: { id, userId, createdAt, cvVersion: { isActive: true } },
      data: { confirmedAt: now },
    })
    const result = await this.prisma.matchResult.findFirst({ where: { id, userId }, include: VERSION })
    if (!result) throw new NotFoundError()
    if (!count) throw new AppError(409, 'stale')
    return result
  }

  private start(userId: number, jobId: number, params: MessageCreateParamsNonStreaming, now: Date): Promise<LlmRun> {
    return this.prisma.$transaction(async (tx) => {
      const run = await claimRun(tx, userId, 'match_analysis', now, {
        model: params.model,
        effort: params.output_config?.effort,
        jobId,
      })
      const running = await tx.llmRun.count({
        where: {
          id: { not: run.id },
          userId,
          unit: 'match_analysis',
          jobId,
          status: 'running',
          createdAt: { gt: new Date(now.getTime() - MATCH_TIMEOUT_MS) },
        },
      })
      if (running) throw new AppError(409, 'running')
      return run
    })
  }
}
