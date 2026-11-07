import type {
  ContentBlock,
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'
import type { Application, Conversation, Job, Message, Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { costUsd } from '../../llm/costs.js'
import type { SendResult, SendStream } from '../../llm/send.js'
import { newMarkId } from '../../llm/untrusted.js'
import { applicationResult } from '../../prompts/coach_agent/coach_agent.material.js'
import { coachAgentRequest } from '../../prompts/coach_agent/coach_agent.request.js'
import { researchHits } from '../../prompts/coach_agent/coach_agent.result.js'
import type {
  ChatSettings,
  CoachApplication,
  CoachToolError,
} from '../../prompts/coach_agent/coach_agent.schemas.js'
import { COACH_AGENT_ERRORS } from '../../prompts/coach_agent/coach_agent.texts.js'
import {
  applicationInputSchema,
  COACH_AGENT_APPLICATION_TOOL,
} from '../../prompts/coach_agent/coach_agent.tools.js'
import type { MatchAnalysis } from '../../prompts/match_analysis/match_analysis.schemas.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import type { ApplicationsService } from '../applications/applications.service.js'
import type { CvsService } from '../cvs/cvs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import type { ResearchReader } from '../research/research.reader.js'
import type { CoachStep } from './coach.schemas.js'

export type ConversationWithMessages = Conversation & { messages: Message[] }

export type Reply = { message: Message | null; stopReason: SendResult['stopReason'] }

export type ReplyHandlers = { onText: (text: string) => void; onStep: (step: CoachStep) => void; signal: AbortSignal }

const STORED_STOP_REASONS = new Set(['end_turn', 'max_tokens', 'model_context_window_exceeded', 'stopped'])

export class CoachService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly send: SendStream,
    private readonly cvs: CvsService,
    private readonly applications: ApplicationsService,
    private readonly matches: MatchesService,
    private readonly research: ResearchReader,
  ) { }

  createConversation(userId: number, title: string): Promise<Conversation> {
    return this.prisma.conversation.create({ data: { userId, title } })
  }

  listConversations(userId: number): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] })
  }

  async renameConversation(userId: number, id: number, title: string): Promise<Conversation> {
    const { count } = await this.prisma.conversation.updateMany({ where: { id, userId }, data: { title } })
    if (!count) throw new NotFoundError('Conversation not found')
    return this.prisma.conversation.findUniqueOrThrow({ where: { id } })
  }

  async deleteConversation(userId: number, id: number): Promise<void> {
    const { count } = await this.prisma.conversation.deleteMany({ where: { id, userId } })
    if (!count) throw new NotFoundError('Conversation not found')
  }

  async getConversation(userId: number, id: number): Promise<ConversationWithMessages> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { id: 'asc' } } },
    })
    if (!conversation) throw new NotFoundError('Conversation not found')
    return conversation
  }

  async addUserMessage(userId: number, id: number, text: string): Promise<Message[]> {
    const conversation = await this.getConversation(userId, id)
    const message = await this.prisma.message.create({
      data: { conversationId: id, role: 'user', content: [{ type: 'text', text }] },
    })
    await this.prisma.conversation.update({ where: { id }, data: { updatedAt: message.createdAt } })
    return [...conversation.messages, message]
  }

  async unansweredHistory(userId: number, id: number): Promise<Message[]> {
    const { messages } = await this.getConversation(userId, id)
    if (messages.at(-1)?.role !== 'user') throw new AppError(409, 'The last message already has an answer')
    return messages
  }

  async reply(
    userId: number,
    conversationId: number,
    history: Message[],
    settings: ChatSettings,
    { onText, onStep, signal }: ReplyHandlers,
  ): Promise<Reply> {
    const messages: MessageParam[] = history.map((message) => ({
      role: message.role,
      content: message.content as unknown as ContentBlockParam[],
    }))
    const [cv, applications, researches] = await Promise.all([
      this.cvs.readyAnalysis(userId),
      this.applications.list(userId),
      this.research.confirmed(userId, conversationId),
    ])
    const context = {
      cv,
      applications: applications.map((application) => coachApplication(application, application.changedAt)),
      researches,
      asOf: new Date().toISOString().slice(0, 10),
      markId: newMarkId(),
    }
    const steps: MessageParam[] = []
    const shown: CoachStep[] = []
    const content: ContentBlock[] = []
    let requests = 0
    let inputTokens = 0
    let outputTokens = 0
    for (;;) {
      const params = coachAgentRequest(messages, steps, settings, context)
      const result = await this.send(params, { onText, onBlock: () => undefined, signal })
      requests += 1
      inputTokens += result.inputTokens
      outputTokens += result.outputTokens
      content.push(...result.content.filter((block) => block.type === 'text'))
      if (result.stopReason === 'tool_use' && params.tool_choice?.type !== 'none') {
        steps.push({ role: 'assistant', content: result.content })
        const results: ToolResultBlockParam[] = []
        for (const block of result.content) {
          if (block.type !== 'tool_use') continue
          const [step, toolResult] = await this.useTool(userId, block)
          shown.push(step)
          onStep(step)
          results.push(toolResult)
        }
        steps.push({ role: 'user', content: results })
        continue
      }
      const cost = costUsd(params.model, {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
      })
      console.info(
        `Coach turn in conversation ${conversationId}: ${requests} requests, ${inputTokens} input and ${outputTokens} output tokens, ${researchHits(researches)} research hits, ${cost.toFixed(4)} $`,
      )
      if (result.stopReason === 'refusal') {
        console.warn(`Coach refusal in conversation ${conversationId}: ${result.stopDetails?.category ?? 'no category'}`)
        return { message: null, stopReason: result.stopReason }
      }
      if (!STORED_STOP_REASONS.has(result.stopReason)) {
        throw new Error(`Unexpected stop reason ${result.stopReason} in conversation ${conversationId}`)
      }
      const hasText = content.some((block) => block.type === 'text' && block.text.length > 0)
      if (!hasText) return { message: null, stopReason: result.stopReason }
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: content as unknown as Prisma.InputJsonArray,
          steps: shown,
          model: params.model,
          effort: params.output_config?.effort,
          quality: settings.quality,
          stopReason: result.stopReason,
          inputTokens,
          outputTokens,
        },
      })
      return { message, stopReason: result.stopReason }
    }
  }

  private async useTool(userId: number, block: ToolUseBlock): Promise<[CoachStep, ToolResultBlockParam]> {
    if (block.name !== COACH_AGENT_APPLICATION_TOOL) return toolError(block.id, 'unknown_tool')
    const input = applicationInputSchema.safeParse(block.input)
    if (!input.success) return toolError(block.id, 'invalid_input')
    try {
      const application = await this.applications.get(userId, input.data.application_id)
      const { current } = await this.matches.overview(userId, application.jobId)
      const changedAt = application.statusChanges[0]?.changedAt ?? application.createdAt
      const match = current?.confirmedAt
        ? {
            score: current.score,
            gaps: current.gaps as MatchAnalysis['gaps'],
            strengths: current.strengths as MatchAnalysis['strengths'],
            createdAt: current.createdAt,
          }
        : null
      const { job } = application
      return [
        { kind: 'application', application_id: application.id, title: job.title, company: job.company },
        {
          type: 'tool_result',
          tool_use_id: block.id,
          content: applicationResult(coachApplication(application, changedAt), job, match),
        },
      ]
    } catch (error) {
      if (error instanceof NotFoundError) return toolError(block.id, 'not_found')
      console.error(error)
      return toolError(block.id, 'unavailable')
    }
  }
}

function coachApplication({ id, status, job }: Application & { job: Job }, changedAt: Date): CoachApplication {
  return { id, status, changedAt, job: { title: job.title, company: job.company, city: job.city } }
}

function toolError(id: string, error: CoachToolError): [CoachStep, ToolResultBlockParam] {
  return [
    { kind: 'application_failed' },
    { type: 'tool_result', tool_use_id: id, content: COACH_AGENT_ERRORS[error], is_error: true },
  ]
}
