import { afterEach, expect, test, vi } from 'vitest'
import { createEmbeddingClient } from '../../src/llm/clients.js'
import * as config from '../../src/modules/search/search.config.js'

const SETTINGS = {
  url: 'http://127.0.0.1:11434',
  model: config.EMBED_MODEL,
  digest: config.EMBED_MODEL_DIGEST,
  numCtx: config.EMBED_NUM_CTX,
  timeoutMs: config.EMBED_TIMEOUT_MS,
}

type Call = { url: string; init: RequestInit }

function fakeOllama(options: { models?: { name: string; digest: string }[]; embed?: () => Response } = {}) {
  const calls: Call[] = []
  const fetchFn = (input: string, init?: RequestInit) => {
    const url = input
    calls.push({ url, init: init ?? {} })
    if (url.endsWith('/api/tags')) {
      return Promise.resolve(
        Response.json({ models: options.models ?? [{ name: config.EMBED_MODEL, digest: config.EMBED_MODEL_DIGEST }] }),
      )
    }
    return Promise.resolve(
      options.embed?.() ?? Response.json({ model: config.EMBED_MODEL, embeddings: [[0.1, 0.2]] }),
    )
  }
  return { calls, fetchFn: fetchFn as unknown as typeof fetch }
}

afterEach(() => {
  vi.useRealTimers()
})

test('every call reads the model list and posts to /api/embed with model, truncate, window and the texts', async () => {
  const { calls, fetchFn } = fakeOllama()
  const embed = createEmbeddingClient(SETTINGS, fetchFn)

  expect(await embed(['a'])).toEqual([[0.1, 0.2]])

  expect(calls.map((call) => call.url)).toEqual([`${SETTINGS.url}/api/tags`, `${SETTINGS.url}/api/embed`])
  expect(calls[1].init.method).toBe('POST')
  const body = JSON.parse(calls[1].init.body as string) as Record<string, unknown>
  expect(body).toEqual({
    model: config.EMBED_MODEL,
    input: ['a'],
    truncate: false,
    options: { num_ctx: config.EMBED_NUM_CTX, num_batch: config.EMBED_NUM_CTX },
  })
  expect(JSON.stringify(calls)).not.toMatch(/authorization|dimensions/iu)
})

test('another digest under the model name stops the call before /api/embed', async () => {
  const { calls, fetchFn } = fakeOllama({ models: [{ name: config.EMBED_MODEL, digest: 'abc' }] })
  await expect(createEmbeddingClient(SETTINGS, fetchFn)(['a'])).rejects.toThrow(
    `embedding model ${config.EMBED_MODEL} has digest abc, expected ${config.EMBED_MODEL_DIGEST}`,
  )
  expect(calls.some((call) => call.url.endsWith('/api/embed'))).toBe(false)
})

test('a missing model stops the call before /api/embed', async () => {
  const { calls, fetchFn } = fakeOllama({ models: [] })
  await expect(createEmbeddingClient(SETTINGS, fetchFn)(['a'])).rejects.toThrow(
    `embedding model ${config.EMBED_MODEL} missing`,
  )
  expect(calls).toHaveLength(1)
})

test('other models in the list, also the latest tag with another digest, are no error', async () => {
  const { calls, fetchFn } = fakeOllama({
    models: [
      { name: 'jina/jina-embeddings-v2-base-de:latest', digest: 'ffff' },
      { name: config.EMBED_MODEL, digest: config.EMBED_MODEL_DIGEST },
    ],
  })
  await createEmbeddingClient(SETTINGS, fetchFn)(['a'])
  expect((JSON.parse(calls[1].init.body as string) as { model: string }).model).toBe(config.EMBED_MODEL)
})

test('the client only reads the model list and embeds, it never pulls, copies or deletes', async () => {
  const { calls, fetchFn } = fakeOllama()
  const embed = createEmbeddingClient(SETTINGS, fetchFn)
  await embed(['a'])
  await embed(['b'])
  expect(calls.every((call) => /\/api\/(tags|embed)$/u.test(call.url))).toBe(true)
})

test('an error status of Ollama becomes the error of the call with its text', async () => {
  const { fetchFn } = fakeOllama({
    embed: () => Response.json({ error: 'the input length exceeds the context length' }, { status: 400 }),
  })
  await expect(createEmbeddingClient(SETTINGS, fetchFn)(['a'])).rejects.toThrow(
    'ollama 400: the input length exceeds the context length',
  )
})

test('an answer naming another model is an error', async () => {
  const { fetchFn } = fakeOllama({ embed: () => Response.json({ model: 'other', embeddings: [[1]] }) })
  await expect(createEmbeddingClient(SETTINGS, fetchFn)(['a'])).rejects.toThrow(
    `embedding model other, expected ${config.EMBED_MODEL}`,
  )
})

test('a call without an answer in EMBED_TIMEOUT_MS is aborted', async () => {
  vi.useFakeTimers()
  const fetchFn = ((_input: string, init: RequestInit) =>
    new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch
  const call = createEmbeddingClient(SETTINGS, fetchFn)(['a'])
  const expectation = expect(call).rejects.toThrow(`embedding timed out after ${config.EMBED_TIMEOUT_MS} ms`)
  await vi.advanceTimersByTimeAsync(config.EMBED_TIMEOUT_MS)
  await expectation
})

test('the model constant has a fixed tag and the digest starts with it', () => {
  expect(config.EMBED_MODEL.endsWith(':latest')).toBe(false)
  const tag = config.EMBED_MODEL.split(':')[1]
  expect(config.EMBED_MODEL_DIGEST.startsWith(tag)).toBe(true)
  expect(config.EMBED_MODEL_DIGEST).toMatch(/^[0-9a-f]{64}$/u)
  expect(config.EMBED_TIMEOUT_MS).toBeLessThan(300_000)
})
