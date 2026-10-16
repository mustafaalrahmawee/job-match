import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches'
import type { MessageCreateParamsBase, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Express } from 'express'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { PrismaClient, User } from '../src/generated/prisma/client.js'
import type { Batches } from '../src/llm/batch.js'
import type { SendStream, StreamHandlers, StreamResult } from '../src/llm/send.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { createPrisma } from '../src/shared/prisma.js'

export const TOKEN_TTL_DAYS = 30

export type FakeReply = (handlers: StreamHandlers) => Promise<StreamResult>

export type FakeModel = {
  send: SendStream
  requests: MessageCreateParamsBase[]
  answer(reply: FakeReply): void
}

export function streamedText(text: string, stopReason: StreamResult['stopReason'] = 'end_turn'): FakeReply {
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

export function useTestDatabase(): {
  prisma: PrismaClient
  app: Express
  auth: AuthService
  model: FakeModel
  batches: FakeBatches
} {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const model = fakeModel()
  const batches = fakeBatches()
  const app = createApp({ prisma, tokenTtlDays: TOKEN_TTL_DAYS, send: model.send, batches })
  const auth = new AuthService(prisma, TOKEN_TTL_DAYS)
  beforeEach(() => {
    model.requests.length = 0
    model.answer(streamedText('Hallo, ich bin dein Coach.'))
    batches.requests.length = 0
    batches.results.clear()
    batches.lookups = 0
    batches.failSubmit = false
    return prisma.user.deleteMany()
  })
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth, model, batches }
}

export function createAnna(auth: AuthService): Promise<User> {
  return auth.createUser('anna@example.com', 'richtig-geheim')
}

export async function bearerFor(auth: AuthService, user: User): Promise<{ Authorization: string }> {
  const { token } = await auth.issueToken(user)
  return { Authorization: `Bearer ${token}` }
}
