import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { RequestHandler, Response } from 'express'
import type { StreamHandlers } from '../../llm/send.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  conversationIdSchema,
  createConversationSchema,
  sendMessageSchema,
  type ConversationOutput,
  type MessageOutput,
} from './coach.schemas.js'
import type { CoachService, Reply } from './coach.service.js'

export class CoachController {
  constructor(private readonly coach: CoachService) { }

  create: RequestHandler = async (req, res) => {
    const { title } = createConversationSchema.parse(req.body)
    const conversation = await this.coach.createConversation(authOf(req).user.id, title)
    res.status(201).json({
      id: conversation.id,
      title: conversation.title,
      messages: [],
    } satisfies ConversationOutput)
  }

  show: RequestHandler = async (req, res) => {
    const id = conversationIdSchema.parse(req.params.id)
    const conversation = await this.coach.getConversation(authOf(req).user.id, id)
    const messages: MessageOutput[] = conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: (message.content as unknown as ContentBlockParam[])
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join(''),
      stop_reason: message.stopReason,
      created_at: message.createdAt,
    }))
    res.json({ id: conversation.id, title: conversation.title, messages } satisfies ConversationOutput)
  }

  sendMessage: RequestHandler = async (req, res) => {
    const id = conversationIdSchema.parse(req.params.id)
    const { content } = sendMessageSchema.parse(req.body)
    const history = await this.coach.addUserMessage(authOf(req).user.id, id, content)
    await streamReply(res, (handlers) => this.coach.reply(id, history, handlers))
  }

  retry: RequestHandler = async (req, res) => {
    const id = conversationIdSchema.parse(req.params.id)
    const history = await this.coach.unansweredHistory(authOf(req).user.id, id)
    await streamReply(res, (handlers) => this.coach.reply(id, history, handlers))
  }
}

async function streamReply(res: Response, run: (handlers: StreamHandlers) => Promise<Reply>): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) abort.abort()
  })
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  try {
    const reply = await run({
      onText: (text) => res.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`),
      signal: abort.signal,
    })
    const message: MessageOutput | null = reply.message && {
      id: reply.message.id,
      role: reply.message.role,
      text: (reply.message.content as unknown as ContentBlockParam[])
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join(''),
      stop_reason: reply.message.stopReason,
      created_at: reply.message.createdAt,
    }
    res.write(`event: done\ndata: ${JSON.stringify({ message, stop_reason: reply.stopReason })}\n\n`)
  } catch (error) {
    console.error(error)
    res.write(`event: error\ndata: ${JSON.stringify({ detail: 'The coach could not answer' })}\n\n`)
  }
  res.end()
}
