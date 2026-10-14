import type { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { Conversation, Message, Prisma, PrismaClient } from '../../generated/prisma/client.js'
import type { SendStream, StreamHandlers, StreamResult } from '../../llm/send.js'
import { type ChatSettings, coachChatRequest } from '../../prompts/coach_chat.js'
import { AppError, NotFoundError } from '../../shared/errors.js'

export type ConversationWithMessages = Conversation & { messages: Message[] }

export type Reply = { message: Message | null; stopReason: StreamResult['stopReason'] }

const STORED_STOP_REASONS = new Set(['end_turn', 'max_tokens', 'model_context_window_exceeded', 'stopped'])

export class CoachService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly send: SendStream,
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
    conversationId: number,
    history: Message[],
    settings: ChatSettings,
    handlers: StreamHandlers,
  ): Promise<Reply> {
    const messages: MessageParam[] = history.map((message) => ({
      role: message.role,
      content: message.content as unknown as ContentBlockParam[],
    }))
    const params = coachChatRequest(messages, settings)
    const result = await this.send(params, handlers)
    if (result.stopReason === 'refusal') {
      console.warn(`Coach refusal in conversation ${conversationId}: ${result.stopDetails?.category ?? 'no category'}`)
      return { message: null, stopReason: result.stopReason }
    }
    if (!STORED_STOP_REASONS.has(result.stopReason)) {
      throw new Error(`Unexpected stop reason ${result.stopReason} in conversation ${conversationId}`)
    }
    const hasText = result.content.some((block) => block.type === 'text' && block.text.length > 0)
    if (!hasText) return { message: null, stopReason: result.stopReason }
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.content as unknown as Prisma.InputJsonArray,
        model: params.model,
        effort: params.output_config?.effort,
        quality: settings.quality,
        stopReason: result.stopReason,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
    return { message, stopReason: result.stopReason }
  }
}
