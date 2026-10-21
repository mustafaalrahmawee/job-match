import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches'
import type { MessageCreateParamsBase, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Express } from 'express'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { PrismaClient, User } from '../src/generated/prisma/client.js'
import type { Batches } from '../src/llm/batch.js'
import type { SendMessage, SendResult, SendStream, StreamHandlers } from '../src/llm/send.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { BaClient } from '../src/modules/jobs/jobs.ba.js'
import { createPrisma } from '../src/shared/prisma.js'

export const TOKEN_TTL_DAYS = 30

export type FakeReply = (handlers: StreamHandlers) => Promise<SendResult>

export type FakeModel = {
  send: SendStream
  requests: MessageCreateParamsBase[]
  answer(reply: FakeReply): void
}

export function streamedText(text: string, stopReason: SendResult['stopReason'] = 'end_turn'): FakeReply {
  return ({ onText }) => {
    for (const word of text.split(/(?<= )/)) onText(word)
    return Promise.resolve({
      content: [{ type: 'text', text, citations: null }],
      stopReason,
      stopDetails: null,
      inputTokens: 120,
      outputTokens: 30,
    })
  }
}

export function fakeModel(): FakeModel {
  let reply: FakeReply = streamedText('Hallo, ich bin dein Coach.')
  const requests: MessageCreateParamsBase[] = []
  return {
    requests,
    send: (params, handlers) => {
      requests.push(structuredClone(params))
      return reply(handlers)
    },
    answer(next) {
      reply = next
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

export type FakeBatches = Batches & {
  requests: { batchId: string; customId: string; params: MessageCreateParamsNonStreaming }[]
  results: Map<string, MessageBatchResult>
  lookups: number
  failSubmit: boolean
}

export function fakeBatches(): FakeBatches {
  const batches: FakeBatches = {
    requests: [],
    results: new Map(),
    lookups: 0,
    failSubmit: false,
    submit(customId, params) {
      if (batches.failSubmit) return Promise.reject(new Error('Batch API down'))
      const batchId = `batch-${batches.requests.length + 1}`
      batches.requests.push({ batchId, customId, params: structuredClone(params) })
      return Promise.resolve(batchId)
    },
    result(batchId) {
      batches.lookups += 1
      return Promise.resolve(batches.results.get(batchId) ?? null)
    },
  }
  return batches
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
  batches: FakeBatches
  ba: FakeBa
} {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const model = fakeModel()
  const messages = fakeMessages()
  const batches = fakeBatches()
  const ba = fakeBa()
  const app = createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    batches,
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
    batches.requests.length = 0
    batches.results.clear()
    batches.lookups = 0
    batches.failSubmit = false
    await prisma.user.deleteMany()
  })
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth, model, messages, batches, ba }
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
  return contents
    .flatMap((content) =>
      typeof content === 'string' ? [content] : content.map((block) => (block.type === 'text' ? block.text : '')),
    )
    .join('\n')
}
