import type { MessageCreateParamsBase, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Express } from 'express'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { PrismaClient, User } from '../src/generated/prisma/client.js'
import type { SendMessage, SendResult, SendStream, StreamHandlers } from '../src/llm/send.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { BaClient } from '../src/modules/jobs/jobs.ba.js'
import { createPrisma } from '../src/shared/prisma.js'

export const TOKEN_TTL_DAYS = 30

export type FakeReply = (handlers: StreamHandlers) => Promise<SendResult>

export type FakeModel = {
  send: SendStream
  requests: MessageCreateParamsNonStreaming[]
  answer(...replies: FakeReply[]): void
}

export function streamedText(text: string, stopReason: SendResult['stopReason'] = 'end_turn'): FakeReply {
  return streamed({ content: [{ type: 'text', text, citations: null }], stopReason })
}

export function streamed({
  content,
  stopReason,
  webSearches = 0,
}: Pick<SendResult, 'content' | 'stopReason'> & { webSearches?: number }): FakeReply {
  return ({ onText, onBlock }) => {
    for (const block of content) {
      if (block.type === 'text') for (const word of block.text.split(/(?<= )/)) onText(word)
      onBlock(block)
    }
    return Promise.resolve({ content, stopReason, stopDetails: null, inputTokens: 120, outputTokens: 30, webSearches })
  }
}

export function fakeModel(): FakeModel {
  let replies: FakeReply[] = [streamedText('Hallo, ich bin dein Coach.')]
  const requests: MessageCreateParamsNonStreaming[] = []
  return {
    requests,
    send: (params, handlers) => {
      requests.push(structuredClone(params))
      const reply = replies.length > 1 ? replies.shift()! : replies[0]
      return reply(handlers)
    },
    answer(...next) {
      replies = next
    },
  }
}

export type FakeMessageReply = () => Promise<SendResult>

export type FakeMessages = {
  send: SendMessage
  requests: MessageCreateParamsNonStreaming[]
  answer(reply: FakeMessageReply): void
}

export function sentText(text: string, stopReason: SendResult['stopReason'] = 'end_turn'): FakeMessageReply {
  return () =>
    Promise.resolve({
      content: [
        { type: 'thinking', thinking: 'Notiz', signature: 'sig' },
        { type: 'text', text, citations: null },
      ],
      stopReason,
      stopDetails: null,
      inputTokens: 900,
      outputTokens: 300,
      webSearches: 0,
    })
}

const NO_REPLY: FakeMessageReply = () => Promise.reject(new Error('No reply set'))

export function fakeMessages(): FakeMessages {
  let reply = NO_REPLY
  const requests: MessageCreateParamsNonStreaming[] = []
  return {
    requests,
    send: (params) => {
      requests.push(structuredClone(params))
      return reply()
    },
    answer(next) {
      reply = next
    },
  }
}

export type FakeBa = {
  client: BaClient
  searches: Map<string, unknown>
  details: Map<string, unknown>
  requests: { url: URL; headers: RequestInit['headers'] }[]
  down: boolean
}

export function fakeBa(): FakeBa {
  const ba: FakeBa = {
    searches: new Map(),
    details: new Map(),
    requests: [],
    down: false,
    client: new BaClient((input, init) => {
      const url = new URL(input)
      ba.requests.push({ url, headers: init.headers })
      if (ba.down) return Promise.reject(new Error('Bundesagentur down'))
      const [, id] = url.pathname.split('/jobdetails/')
      const body = id
        ? ba.details.get(Buffer.from(decodeURIComponent(id), 'base64').toString())
        : (ba.searches.get(`${url.searchParams.get('was')}:${url.searchParams.get('page')}`) ?? { maxErgebnisse: 0 })
      if (body === undefined) return Promise.resolve(new Response('{}', { status: 404 }))
      return Promise.resolve(Response.json(body))
    }),
  }
  return ba
}

export function useTestDatabase(): {
  prisma: PrismaClient
  app: Express
  auth: AuthService
  model: FakeModel
  messages: FakeMessages
  ba: FakeBa
} {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const model = fakeModel()
  const messages = fakeMessages()
  const ba = fakeBa()
  const app = createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    ba: ba.client,
  })
  const auth = new AuthService(prisma, TOKEN_TTL_DAYS)
  beforeEach(async () => {
    ba.searches.clear()
    ba.details.clear()
    ba.requests.length = 0
    ba.down = false
    await prisma.job.deleteMany()
    await prisma.jobImport.deleteMany()
    model.requests.length = 0
    messages.requests.length = 0
    messages.answer(NO_REPLY)
    model.answer(streamedText('Hallo, ich bin dein Coach.'))
    await prisma.user.deleteMany()
  })
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth, model, messages, ba }
}

export function createAnna(auth: AuthService): Promise<User> {
  return auth.createUser('anna@example.com', 'richtig-geheim')
}

export async function bearerFor(auth: AuthService, user: User): Promise<{ Authorization: string }> {
  const { token } = await auth.issueToken(user)
  return { Authorization: `Bearer ${token}` }
}

export function requestText({ system, messages }: MessageCreateParamsBase): string {
  const contents = [system ?? [], ...messages.map((message) => message.content)]
  const texts = (content: (typeof contents)[number]): string[] =>
    typeof content === 'string'
      ? [content]
      : content.flatMap((block) => {
          if (block.type === 'text') return [block.text]
          if (block.type === 'tool_result' && block.content !== undefined) return texts(block.content as typeof content)
          return []
        })
  return contents.flatMap(texts).join('\n')
}
