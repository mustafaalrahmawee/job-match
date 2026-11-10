import { APIError } from '@anthropic-ai/sdk'
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { PDFDocument } from 'pdf-lib'
import type { CvVersion, PrismaClient } from '../../generated/prisma/client.js'
import { structuredOutput, type SendMessage, type SendResult } from '../../llm/send.js'
import * as cvConfig from '../../prompts/cv_analysis/cv_analysis.config.js'
import { cvAnalysisRequest } from '../../prompts/cv_analysis/cv_analysis.request.js'
import { cvAnalysisResult } from '../../prompts/cv_analysis/cv_analysis.result.js'
import {
  cvAnalysisSchema,
  type CvAnalysis,
  type CvRole,
  type SuspiciousText,
} from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import { claimRun } from '../../shared/runs.js'
import type { AnalysisError } from './cvs.schemas.js'

export type CvVersionInfo = Omit<CvVersion, 'pdf' | 'suspiciousText'>

export type CvVersionSummaryInfo = Omit<CvVersion, 'pdf' | 'analysis' | 'suspiciousText'>

type Outcome =
  | { analysis: CvAnalysis; suspiciousText: SuspiciousText; hits: number }
  | { error: AnalysisError; suspiciousText?: SuspiciousText; hits?: number }

export const CV_ANALYSIS_TIMEOUT_MS = 180_000

const HIDDEN = { pdf: true, suspiciousText: true } as const

const CV_LANGUAGES = new Set(['de', 'en'])

export class CvsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sendMessage: SendMessage,
  ) { }

  async upload(userId: number, pdf: Buffer, now = new Date()): Promise<CvVersionInfo> {
    const pages = await pageCount(pdf)
    if (!pages) throw new AppError(422, 'unreadable')
    if (pages > cvConfig.MAX_PAGES) throw new AppError(422, 'too_many_pages')
    const params = analysisRequest(pdf, now)
    const { version, runId } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const run = params ? await claimRun(tx, userId, 'cv_analysis', now, usedModel(params)) : null
      await tx.cvVersion.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
      const version = await tx.cvVersion.create({
        data: { userId, pdf: new Uint8Array(pdf), analyzedAt: now, ...start(params) },
        omit: HIDDEN,
      })
      return { version, runId: run?.id }
    })
    return params && runId ? this.analyse(version.id, runId, params, now) : version
  }

  list(userId: number): Promise<CvVersionSummaryInfo[]> {
    return this.prisma.cvVersion.findMany({
      where: { userId },
      omit: { ...HIDDEN, analysis: true },
      orderBy: { id: 'desc' },
    })
  }

  activate(userId: number, id: number): Promise<CvVersionInfo> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const exists = await tx.cvVersion.count({ where: { id, userId } })
      if (!exists) throw new NotFoundError('CV not found')
      await tx.cvVersion.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
      return tx.cvVersion.update({ where: { id }, data: { isActive: true }, omit: HIDDEN })
    })
  }

  async remove(userId: number, id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const version = await tx.cvVersion.findFirst({ where: { id, userId }, select: { isActive: true } })
      if (!version) throw new NotFoundError('CV not found')
      if (version.isActive) throw new AppError(409, 'The active CV cannot be deleted')
      await tx.cvVersion.delete({ where: { id } })
    })
  }

  async active(userId: number, now = new Date()): Promise<CvVersionInfo> {
    const version = await this.prisma.cvVersion.findFirst({
      where: { userId, isActive: true },
      omit: HIDDEN,
      orderBy: { id: 'desc' },
    })
    if (!version) throw new NotFoundError('No CV uploaded')
    if (version.analysisStatus !== 'running') return version
    if (now.getTime() - version.analyzedAt.getTime() < CV_ANALYSIS_TIMEOUT_MS) return version
    await this.prisma.cvVersion.updateMany({
      where: { id: version.id, analysisStatus: 'running', analyzedAt: version.analyzedAt },
      data: { analysisStatus: 'failed', analysisError: 'timeout' },
    })
    return this.prisma.cvVersion.findUniqueOrThrow({ where: { id: version.id }, omit: HIDDEN })
  }

  async readyAnalysis(userId: number): Promise<{ id: number; role: CvRole; analysis: CvAnalysis } | null> {
    const version = await this.prisma.cvVersion.findFirst({
      where: { userId, isActive: true, analysisStatus: 'ready', role: { not: null } },
      select: { id: true, role: true, analysis: true },
    })
    if (!version?.analysis || !version.role) return null
    return { id: version.id, role: version.role as CvRole, analysis: version.analysis as CvAnalysis }
  }

  async retry(userId: number, id: number, now = new Date()): Promise<CvVersionInfo> {
    const { version, params, runId } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const found = await tx.cvVersion.findFirst({
        where: { id, userId },
        select: { pdf: true, isActive: true, analysisStatus: true },
      })
      if (!found) throw new NotFoundError('CV not found')
      if (!found.isActive || !['none', 'failed'].includes(found.analysisStatus)) {
        throw new AppError(409, 'The CV cannot be analysed again')
      }
      const params = analysisRequest(found.pdf, now)
      const run = params ? await claimRun(tx, userId, 'cv_analysis', now, usedModel(params)) : null
      const version = await tx.cvVersion.update({
        where: { id },
        data: { analyzedAt: now, ...start(params) },
        omit: HIDDEN,
      })
      return { version, params, runId: run?.id }
    })
    return params && runId ? this.analyse(id, runId, params, now) : version
  }

  async confirmRole(userId: number, id: number, role: CvRole): Promise<CvVersionInfo> {
    const { count } = await this.prisma.cvVersion.updateMany({
      where: { id, userId, isActive: true, analysisStatus: 'ready' },
      data: { role },
    })
    if (!count) {
      const exists = await this.prisma.cvVersion.count({ where: { id, userId } })
      if (!exists) throw new NotFoundError('CV not found')
      throw new AppError(409, 'The CV has no analysis yet')
    }
    return this.prisma.cvVersion.findUniqueOrThrow({ where: { id }, omit: HIDDEN })
  }

  private async analyse(
    id: number,
    runId: number,
    params: MessageCreateParamsNonStreaming,
    analyzedAt: Date,
  ): Promise<CvVersionInfo> {
    const signal = AbortSignal.timeout(Math.max(0, analyzedAt.getTime() + CV_ANALYSIS_TIMEOUT_MS - Date.now()))
    let outcome: Outcome
    let usage = {}
    try {
      const result = await this.sendMessage(params, { signal })
      usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens }
      outcome = evaluate(result)
    } catch (error) {
      console.error(error)
      const tooLong =
        error instanceof APIError && (error.status === 413 || (error.status === 400 && /too long/i.test(error.message)))
      outcome = { error: signal.aborted ? 'timeout' : tooLong ? 'too_long' : 'unavailable' }
    }
    if (outcome.hits) console.warn(`CV version ${id}: ${outcome.hits} entries removed or cleaned before storing`)
    await this.prisma.llmRun.update({
      where: { id: runId },
      data: { ...usage, status: 'analysis' in outcome ? 'ready' : 'failed' },
    })
    await this.prisma.cvVersion.updateMany({
      where: { id, analysisStatus: 'running', analyzedAt },
      data: {
        ...(outcome.suspiciousText?.length ? { suspiciousText: outcome.suspiciousText } : {}),
        ...('analysis' in outcome
          ? { analysisStatus: 'ready', analysis: outcome.analysis }
          : { analysisStatus: 'failed', analysisError: outcome.error }),
      },
    })
    const version = await this.prisma.cvVersion.findUnique({ where: { id }, omit: HIDDEN })
    if (!version) throw new NotFoundError('CV not found')
    return version
  }
}

async function pageCount(pdf: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false })
    return doc.isEncrypted ? 0 : doc.getPageCount()
  } catch {
    return 0
  }
}

function analysisRequest(pdf: Uint8Array, analyzedAt: Date): MessageCreateParamsNonStreaming | null {
  try {
    return cvAnalysisRequest(Buffer.from(pdf).toString('base64'), analyzedAt)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Prompt over budget')) return null
    throw error
  }
}

function start(params: MessageCreateParamsNonStreaming | null) {
  return params
    ? { analysisStatus: 'running' as const, analysisError: null }
    : { analysisStatus: 'failed' as const, analysisError: 'too_long' }
}

function usedModel(params: MessageCreateParamsNonStreaming) {
  return { model: params.model, effort: params.output_config?.effort }
}

function evaluate(result: SendResult): Outcome {
  const output = structuredOutput(result, cvAnalysisSchema)
  if ('error' in output) return output
  const { analysis, suspiciousText, hits } = cvAnalysisResult(output.data)
  if (!analysis.is_cv) return { error: 'not_cv', suspiciousText, hits }
  if (!CV_LANGUAGES.has(analysis.language.toLowerCase())) return { error: 'language', suspiciousText, hits }
  return { analysis, suspiciousText, hits }
}
