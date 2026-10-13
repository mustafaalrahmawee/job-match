import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'
import type { Express } from 'express'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { PrismaClient, User } from '../src/generated/prisma/client.js'
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

export function useTestDatabase(): {
  prisma: PrismaClient
  app: Express
  auth: AuthService
  model: FakeModel
} {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const model = fakeModel()
  const app = createApp({ prisma, tokenTtlDays: TOKEN_TTL_DAYS, send: model.send })
  const auth = new AuthService(prisma, TOKEN_TTL_DAYS)
  beforeEach(() => {
    model.requests.length = 0
    model.answer(streamedText('Hallo, ich bin dein Coach.'))
    return prisma.user.deleteMany()
  })
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth, model }
}

export function createAnna(auth: AuthService): Promise<User> {
  return auth.createUser('anna@example.com', 'richtig-geheim')
}

export async function bearerFor(auth: AuthService, user: User): Promise<{ Authorization: string }> {
  const { token } = await auth.issueToken(user)
  return { Authorization: `Bearer ${token}` }
}
