import type { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { Conversation, Message, Prisma, PrismaClient } from '../../generated/prisma/client.js'
import type { SendStream, StreamHandlers } from '../../llm/send.js'
import { COACH_CHAT_EFFORT, COACH_CHAT_MODEL, coachChatRequest } from '../../prompts/coach_chat.js'
import { AppError, NotFoundError } from '../../shared/errors.js'

export type ConversationWithMessages = Conversation & { messages: Message[] }

export type Reply = { message: Message | null; stopReason: string }

export class CoachService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly send: SendStream,
  ) { }

  createConversation(userId: number, title: string): Promise<Conversation> {
    return this.prisma.conversation.create({ data: { userId, title } })
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
    return [...conversation.messages, message]
  }

  async unansweredHistory(userId: number, id: number): Promise<Message[]> {
    const { messages } = await this.getConversation(userId, id)
    if (messages.at(-1)?.role !== 'user') throw new AppError(409, 'The last message already has an answer')
    return messages
  }

  async reply(conversationId: number, history: Message[], handlers: StreamHandlers): Promise<Reply> {
    const messages: MessageParam[] = history.map((message) => ({
      role: message.role,
      content: message.content as unknown as ContentBlockParam[],
    }))
    const result = await this.send(coachChatRequest(messages), handlers)
    const hasText = result.content.some((block) => block.type === 'text' && block.text.length > 0)
    if (!hasText || result.stopReason === 'refusal') return { message: null, stopReason: result.stopReason }
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.content as unknown as Prisma.InputJsonArray,
        model: COACH_CHAT_MODEL,
        effort: COACH_CHAT_EFFORT,
        stopReason: result.stopReason,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
    return { message, stopReason: result.stopReason }
  }
}
