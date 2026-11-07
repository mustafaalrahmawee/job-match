import { randomBytes } from 'node:crypto'
import type { ContentBlock, MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { CompanyResearch, CompanyResearchRun, PrismaClient } from '../../generated/prisma/client.js'
import { costUsd } from '../../llm/costs.js'
import type { SendResult, SendStream } from '../../llm/send.js'
import {
  COMPANY_RESEARCH_CONTINUATIONS,
  COMPANY_RESEARCH_WEB_SEARCHES,
} from '../../prompts/company_research/company_research.config.js'
import { companyResearchRequest } from '../../prompts/company_research/company_research.request.js'
import { companyResearchResult } from '../../prompts/company_research/company_research.result.js'
import type {
  CompanyResearchInput,
  CompanyResearchSource,
} from '../../prompts/company_research/company_research.schemas.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import type { CoachService } from '../coach/coach.service.js'
import type { ResearchOutcome, ResearchStep } from './research.schemas.js'

export const RESEARCH_RUNS_PER_DAY = 5

const UNFINISHED_STOP_REASONS = new Set(['pause_turn', 'max_tokens', 'model_context_window_exceeded'])

export type ResearchRun = {
  id: number
  userId: number
  conversationId: number
  input: CompanyResearchInput
  asOf: string
  markId: string
  params: MessageCreateParamsNonStreaming
}

export type ResearchHandlers = { onStep: (step: ResearchStep) => void; signal: AbortSignal }

export type ResearchReply = { research: CompanyResearch | null; outcome: ResearchOutcome }

export class ResearchService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly send: SendStream,
    private readonly coach: CoachService,
  ) { }

  async list(userId: number, conversationId: number): Promise<CompanyResearch[]> {
    await this.coach.getConversation(userId, conversationId)
    return this.prisma.companyResearch.findMany({ where: { userId, conversationId }, orderBy: { id: 'asc' } })
  }

  async start(userId: number, conversationId: number, input: CompanyResearchInput, now = new Date()): Promise<ResearchRun> {
    await this.coach.getConversation(userId, conversationId)
    const asOf = now.toISOString().slice(0, 10)
    const markId = randomBytes(4).toString('hex')
    const params = companyResearchRequest(input, asOf, markId)
    const { id } = await this.count(userId, params, now)
    return { id, userId, conversationId, input, asOf, markId, params }
  }

  async finish(run: ResearchRun, { onStep, signal }: ResearchHandlers): Promise<ResearchReply> {
    const { id, input, asOf, markId } = run
    const steps: MessageParam[] = []
    const shown: ResearchStep[] = []
    const content: ContentBlock[] = []
    const queries = new Map<string, string>()
    const show = (step: ResearchStep) => {
      shown.push(step)
      onStep(step)
    }
    const onBlock = (block: ContentBlock) => {
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        queries.set(block.id, companyResearchResult([block]).queries[0] ?? '')
      }
      if (block.type === 'web_search_tool_result') {
        const sources = Array.isArray(block.content) ? block.content.length : null
        show({ kind: 'web_search', query: queries.get(block.tool_use_id) ?? '', sources })
        queries.delete(block.tool_use_id)
      }
    }
    const usage = { inputTokens: 0, outputTokens: 0 }
    let requests = 0
    let continuations = 0
    let searches = 0
    const label = `Company research ${id}`
    const report = () => {
      const { queries: searched, suspiciousText, hits } = companyResearchResult(content)
      const name = input.company.split(/[\s,]+/)[0].toLowerCase()
      const offTopic = searched.filter((query) => !query.toLowerCase().includes(name)).length
      const cost = costUsd(run.params.model, {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
        server_tool_use: { web_search_requests: searches },
      })
      console.info(
        `${label}: ${requests} requests, ${continuations} continuations, ${usage.inputTokens} input and ${usage.outputTokens} output tokens, ${searches} web searches, ${suspiciousText ? 1 : 0} flagged, ${offTopic} queries without the company, ${hits} check hits, ${cost.toFixed(4)} $`,
      )
      if (searches > COMPANY_RESEARCH_WEB_SEARCHES) console.warn(`${label}: ${searches} web searches with ${continuations} continuations`)
    }
    try {
      let params = run.params
      let result: SendResult
      for (; ;) {
        result = await this.send(params, { onText: () => undefined, onBlock, signal })
        requests += 1
        searches += result.webSearches
        usage.inputTokens += result.inputTokens
        usage.outputTokens += result.outputTokens
        content.push(...result.content)
        if (result.stopReason !== 'pause_turn' || continuations >= COMPANY_RESEARCH_CONTINUATIONS) break
        continuations += 1
        steps.push({ role: 'assistant', content: result.content })
        params = companyResearchRequest(input, asOf, markId, steps)
      }
      for (const query of queries.values()) show({ kind: 'web_search', query, sources: null })
      const parsed = companyResearchResult(content)
      if (result.stopReason === 'refusal') console.warn(`${label}: refusal, ${result.stopDetails?.category ?? 'no category'}`)
      if (UNFINISHED_STOP_REASONS.has(result.stopReason)) console.warn(`${label}: ended with ${result.stopReason}`)
      const outcome = outcomeOf(result.stopReason, parsed.text)
      if (outcome !== 'ready') {
        await this.prisma.companyResearchRun.updateMany({ where: { id }, data: { ...usage, status: 'failed' } })
        return { research: null, outcome }
      }
      const [research] = await this.prisma.$transaction([
        this.prisma.companyResearch.create({
          data: {
            userId: run.userId,
            conversationId: run.conversationId,
            company: input.company,
            question: input.question,
            content: parsed.text,
            sources: parsed.sources,
            suspiciousText: parsed.suspiciousText,
            suspiciousSources: parsed.suspiciousSources,
            steps: shown,
            queries: parsed.queries,
            searchResults: parsed.searchResults,
          },
        }),
        this.prisma.companyResearchRun.update({ where: { id }, data: { ...usage, status: 'ready' } }),
      ])
      return { research, outcome }
    } catch (error) {
      await this.prisma.companyResearchRun.updateMany({ where: { id }, data: { ...usage, status: 'failed' } })
      throw error
    } finally {
      report()
    }
  }

  async confirm(userId: number, id: number, now = new Date()): Promise<CompanyResearch> {
    const research = await this.prisma.companyResearch.findFirst({ where: { id, userId } })
    if (!research) throw new NotFoundError()
    if (!(research.sources as CompanyResearchSource[]).length) throw new AppError(409, 'no_sources')
    if (research.confirmedAt) return research
    return this.prisma.companyResearch.update({ where: { id }, data: { confirmedAt: now } })
  }

  private count(userId: number, params: MessageCreateParamsNonStreaming, now: Date): Promise<CompanyResearchRun> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
      const today = await tx.companyResearchRun.count({
        where: { userId, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
      })
      if (today >= RESEARCH_RUNS_PER_DAY) throw new AppError(429, 'limit_reached')
      return tx.companyResearchRun.create({
        data: { userId, model: params.model, effort: params.output_config?.effort, createdAt: now },
      })
    })
  }
}

function outcomeOf(stopReason: SendResult['stopReason'], text: string): ResearchOutcome {
  if (stopReason === 'end_turn') return text ? 'ready' : 'empty'
  if (stopReason === 'stopped') return 'stopped'
  if (stopReason === 'refusal') return 'refused'
  if (UNFINISHED_STOP_REASONS.has(stopReason)) return 'unfinished'
  throw new Error(`Unexpected stop reason ${stopReason} in a company research`)
}
