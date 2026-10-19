import type { Message } from '@anthropic-ai/sdk/resources/messages'
import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches'
import type { CvVersion, PrismaClient } from '../../generated/prisma/client.js'
import type { Batches } from '../../llm/batch.js'
import {
  CV_LIST_LIMITS,
  cvAnalysisRequest,
  cvAnalysisSchema,
  type CvAnalysis,
  type CvRole,
} from '../../prompts/cv_analysis.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import type { AnalysisError } from './cvs.schemas.js'

export type CvVersionInfo = Omit<CvVersion, 'pdf'>

export type CvVersionSummaryInfo = Omit<CvVersion, 'pdf' | 'analysis'>

type Outcome = { analysis: CvAnalysis } | { error: AnalysisError }

const CV_LANGUAGES = new Set(['de', 'en'])

export class CvsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly batches: Batches,
  ) { }

  async upload(userId: number, pdf: Buffer): Promise<CvVersionInfo> {
    const version = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      await tx.cvVersion.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
      return tx.cvVersion.create({ data: { userId, pdf: new Uint8Array(pdf), analysisStatus: 'running' } })
    })
    return this.submit(version.id, version.pdf)
  }

  list(userId: number): Promise<CvVersionSummaryInfo[]> {
    return this.prisma.cvVersion.findMany({
      where: { userId },
      omit: { pdf: true, analysis: true },
      orderBy: { id: 'desc' },
    })
  }

  activate(userId: number, id: number): Promise<CvVersionInfo> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const exists = await tx.cvVersion.count({ where: { id, userId } })
      if (!exists) throw new NotFoundError('CV not found')
      await tx.cvVersion.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
      return tx.cvVersion.update({ where: { id }, data: { isActive: true }, omit: { pdf: true } })
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

  async active(userId: number): Promise<CvVersionInfo> {
    const version = await this.prisma.cvVersion.findFirst({
      where: { userId, isActive: true },
      omit: { pdf: true },
      orderBy: { id: 'desc' },
    })
    if (!version) throw new NotFoundError('No CV uploaded')
    if (version.analysisStatus !== 'running' || !version.batchId) return version
    return this.refresh(version, version.batchId)
  }

  async readyAnalysis(userId: number): Promise<{ role: CvRole | null; analysis: CvAnalysis } | null> {
    const version = await this.prisma.cvVersion.findFirst({
      where: { userId, isActive: true, analysisStatus: 'ready' },
      select: { role: true, analysis: true },
    })
    if (!version?.analysis) return null
    return { role: version.role as CvRole | null, analysis: version.analysis as CvAnalysis }
  }

  async retry(userId: number, id: number): Promise<CvVersionInfo> {
    const { count } = await this.prisma.cvVersion.updateMany({
      where: { id, userId, isActive: true, analysisStatus: { in: ['none', 'failed'] } },
      data: { analysisStatus: 'running', analysisError: null, batchId: null },
    })
    if (!count) {
      const exists = await this.prisma.cvVersion.count({ where: { id, userId } })
      if (!exists) throw new NotFoundError('CV not found')
      throw new AppError(409, 'The CV cannot be analysed again')
    }
    const { pdf } = await this.prisma.cvVersion.findUniqueOrThrow({ where: { id }, select: { pdf: true } })
    return this.submit(id, pdf)
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
    return this.prisma.cvVersion.findUniqueOrThrow({ where: { id }, omit: { pdf: true } })
  }

  private async submit(id: number, pdf: Uint8Array): Promise<CvVersionInfo> {
    const params = cvAnalysisRequest(Buffer.from(pdf).toString('base64'))
    let batchId: string
    try {
      batchId = await this.batches.submit(`cv-${id}`, params)
    } catch (error) {
      console.error(error)
      return this.prisma.cvVersion.update({
        where: { id },
        data: { analysisStatus: 'failed', analysisError: 'submit_failed' },
        omit: { pdf: true },
      })
    }
    return this.prisma.cvVersion.update({
      where: { id },
      data: { batchId, effort: params.output_config?.effort },
      omit: { pdf: true },
    })
  }

  private async refresh(version: CvVersionInfo, batchId: string): Promise<CvVersionInfo> {
    let result: MessageBatchResult | null
    try {
      result = await this.batches.result(batchId, `cv-${version.id}`)
    } catch (error) {
      console.error(error)
      return version
    }
    if (!result) return version
    const outcome: Outcome = result.type === 'succeeded' ? evaluate(result.message) : { error: 'batch_failed' }
    const usage =
      result.type === 'succeeded'
        ? {
          model: result.message.model,
          inputTokens: result.message.usage.input_tokens,
          outputTokens: result.message.usage.output_tokens,
          cacheReadTokens: result.message.usage.cache_read_input_tokens,
          cacheWriteTokens: result.message.usage.cache_creation_input_tokens,
        }
        : {}
    await this.prisma.cvVersion.updateMany({
      where: { id: version.id, analysisStatus: 'running', batchId },
      data:
        'analysis' in outcome
          ? { ...usage, analysisStatus: 'ready', analysis: outcome.analysis }
          : { ...usage, analysisStatus: 'failed', analysisError: outcome.error },
    })
    return this.prisma.cvVersion.findUniqueOrThrow({ where: { id: version.id }, omit: { pdf: true } })
  }
}

function evaluate(message: Message): Outcome {
  if (message.stop_reason === 'refusal') return { error: 'refused' }
  if (message.stop_reason === 'max_tokens') return { error: 'too_long' }
  const text = message.content.find((block) => block.type === 'text')
  if (message.stop_reason !== 'end_turn' || !text) return { error: 'invalid_output' }
  let json: unknown
  try {
    json = JSON.parse(text.text)
  } catch {
    return { error: 'invalid_output' }
  }
  const parsed = cvAnalysisSchema.safeParse(json)
  if (!parsed.success) return { error: 'invalid_output' }
  const analysis = parsed.data
  if (!analysis.is_cv) return { error: 'not_cv' }
  if (!CV_LANGUAGES.has(analysis.language.toLowerCase())) return { error: 'language' }
  return {
    analysis: {
      ...analysis,
      positions: analysis.positions.slice(0, CV_LIST_LIMITS.positions),
      skills: analysis.skills.slice(0, CV_LIST_LIMITS.skills),
      education: analysis.education.slice(0, CV_LIST_LIMITS.education),
      languages: analysis.languages.slice(0, CV_LIST_LIMITS.languages),
      strengths: analysis.strengths.slice(0, CV_LIST_LIMITS.strengths),
      weaknesses: analysis.weaknesses.slice(0, CV_LIST_LIMITS.weaknesses),
      tips: analysis.tips.slice(0, CV_LIST_LIMITS.tips),
    },
  }
}
