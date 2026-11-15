import type { MessageCreateParamsBase, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Express } from 'express'
import { ChromaClient } from 'chromadb'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { randomUUID } from 'node:crypto'
import type { CvVersion, Job, Prisma, PrismaClient, User } from '../src/generated/prisma/client.js'
import type { Embed } from '../src/llm/clients.js'
import type { SendMessage, SendResult, SendStream, StreamHandlers } from '../src/llm/send.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { BaClient } from '../src/modules/jobs/jobs.ba.js'
import * as searchConfig from '../src/modules/search/search.config.js'
import { createChromaClient, INDEX_SETTINGS, SearchIndex, type IndexSettings } from '../src/modules/search/search.index.js'
import type { CvAnalysis } from '../src/prompts/cv_analysis/cv_analysis.schemas.js'
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

export type FakeEmbed = {
  embed: Embed
  calls: string[][]
  answer(reply: (texts: string[]) => Promise<unknown[]>): void
}

export function vectorOf(text: string, dimensions = searchConfig.EMBED_DIMENSIONS): number[] {
  const seed = [...text].reduce((sum, char) => (sum * 31 + char.codePointAt(0)!) % 1_000_003, 7)
  return Array.from({ length: dimensions }, (_, index) => ((seed * (index + 1)) % 97) + 1)
}

export function fakeEmbed(dimensions = searchConfig.EMBED_DIMENSIONS): FakeEmbed {
  const byText = (texts: string[]): Promise<unknown[]> => Promise.resolve(texts.map((text) => vectorOf(text, dimensions)))
  let reply = byText
  const fake: FakeEmbed = {
    calls: [],
    embed: (texts) => {
      fake.calls.push([...texts])
      return reply(texts)
    },
    answer(next) {
      reply = next
    },
  }
  fake.answer(byText)
  return fake
}

export function testChroma(): ChromaClient {
  if (!env.TEST_CHROMA_URL) throw new Error('TEST_CHROMA_URL is missing in backend/.env')
  return createChromaClient(env.TEST_CHROMA_URL)
}

export async function clearChroma(chroma: ChromaClient): Promise<void> {
  const kept = [searchConfig.CV_STORE, searchConfig.JOB_STORE].map((prefix) => `${prefix}${searchConfig.STORE_GENERATION}`)
  for (const collection of await chroma.listCollections({ limit: 1000 })) {
    const fits =
      kept.includes(collection.name) &&
      collection.metadata?.embedModel === searchConfig.EMBED_MODEL &&
      collection.metadata?.embedDimensions === searchConfig.EMBED_DIMENSIONS &&
      collection.configuration.hnsw?.ef_search === searchConfig.HNSW_EF_SEARCH
    if (!fits) {
      await chroma.deleteCollection({ name: collection.name })
      continue
    }
    const { ids } = await collection.get({ include: [] })
    if (ids.length) await collection.delete({ ids })
  }
}

export async function dropStores(chroma: ChromaClient): Promise<void> {
  for (const collection of await chroma.listCollections({ limit: 1000 })) {
    await chroma.deleteCollection({ name: collection.name })
  }
}

export function testIndex(chroma: ChromaClient, embed: Embed, settings: Partial<IndexSettings> = {}): SearchIndex {
  return new SearchIndex(chroma, embed, { ...INDEX_SETTINGS, retryDelayMs: 0, ...settings })
}

export function useTestDatabase(): {
  prisma: PrismaClient
  app: Express
  auth: AuthService
  model: FakeModel
  messages: FakeMessages
  ba: FakeBa
  chroma: ChromaClient
  embedder: FakeEmbed
  searchIndex: SearchIndex
} {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const chroma = testChroma()
  const embedder = fakeEmbed()
  const searchIndex = testIndex(chroma, embedder.embed)
  const model = fakeModel()
  const messages = fakeMessages()
  const ba = fakeBa()
  const app = createApp({
    prisma,
    tokenTtlDays: TOKEN_TTL_DAYS,
    sendStream: model.send,
    sendMessage: messages.send,
    ba: ba.client,
    searchIndex,
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
    await clearChroma(chroma)
    embedder.calls.length = 0
    embedder.answer((texts) => Promise.resolve(texts.map((text) => vectorOf(text))))
  })
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth, model, messages, ba, chroma, embedder, searchIndex }
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

export const SEARCH_ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Backend',
  positions: [{ employer: 'Pixelwerk GmbH', title: 'Backend-Entwicklerin', start: '01/2023', ongoing: true, end: null }],
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  education: [{ degree: 'B.Sc. Informatik', institution: 'TU Berlin', year: '2022' }],
  highest_degree: 'B.Sc. Informatik',
  languages: [{ name: 'Deutsch', level: 'C2' }],
  strengths: ['Sorgfalt'],
  weaknesses: ['Kein Kubernetes'],
  tips: ['Kubernetes lernen'],
}

export function createVersion(
  prisma: PrismaClient,
  userId: number,
  data: Partial<Prisma.CvVersionUncheckedCreateInput> = {},
): Promise<CvVersion> {
  return prisma.cvVersion.create({
    data: {
      userId,
      pdf: new Uint8Array([1]),
      analysis: SEARCH_ANALYSIS,
      analysisStatus: 'ready',
      role: 'Backend',
      analyzedAt: new Date(),
      ...data,
    },
  })
}

export function createJob(prisma: PrismaClient, data: Partial<Prisma.JobUncheckedCreateInput> = {}): Promise<Job> {
  const job: Prisma.JobUncheckedCreateInput = {
      source: 'ba',
      externalId: randomUUID(),
      title: 'Backend-Entwickler (m/w/d)',
      company: 'Werkbank GmbH',
      city: 'Kiel',
      description: 'Wir suchen Verstärkung mit TypeScript und PostgreSQL.',
      offerType: 'work',
      fullTime: true,
      partTime: false,
      role: 'Backend',
      publishedAt: new Date(new Date().toISOString().slice(0, 10)),
      ...data,
  }
  return prisma.job.create({ data: job })
}

export function unitVector(angle: number, dimensions = searchConfig.EMBED_DIMENSIONS): number[] {
  return Array.from({ length: dimensions }, (_, index) => (index === 0 ? Math.cos(angle) : index === 1 ? Math.sin(angle) : 0))
}

export async function storeVector(
  index: SearchIndex,
  id: string,
  embedding: number[],
  metadata: Record<string, string | number>,
): Promise<void> {
  const { cvs, jobs } = await index.stores()
  const store = id.startsWith('cv-') ? cvs : jobs
  await store.upsert({ ids: [id], embeddings: [embedding], metadatas: [metadata], documents: store === jobs ? ['text'] : undefined })
}

export function dayStart(date: Date): number {
  return Date.parse(date.toISOString().slice(0, 10)) / 1000
}
