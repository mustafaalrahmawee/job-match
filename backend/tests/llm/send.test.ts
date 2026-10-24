import Anthropic from '@anthropic-ai/sdk'
import { expect, test } from 'vitest'
import { createSendMessage, createSendStream } from '../../src/llm/send.js'
import { coachAgentRequest } from '../../src/prompts/coach_agent.js'
import { jobExtractRequest } from '../../src/prompts/job_extract.js'

const EVENTS = [
  {
    type: 'message_start',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 1 },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hallo ' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Anna' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 7 } },
  { type: 'message_stop' },
]

function sse(event: object): Uint8Array {
  return new TextEncoder().encode(`event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`)
}

function client(events: object[], hangAfter = events.length): Anthropic {
  const fetch = (_url: unknown, init?: RequestInit): Promise<Response> => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events.slice(0, hangAfter)) controller.enqueue(sse(event))
        if (hangAfter >= events.length) controller.close()
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
      },
    })
    return Promise.resolve(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
  }
  return new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 })
}

const params = coachAgentRequest(
  [{ role: 'user', content: 'Hallo' }],
  [],
  { quality: 'normal', effort: 'medium' },
  { cv: null, applications: [], asOf: '2026-10-23' },
)

const quiet = { onText: () => undefined, onBlock: () => undefined, signal: new AbortController().signal }

test('a finished stream returns content, stop reason and tokens', async () => {
  const texts: string[] = []
  const send = createSendStream(client(EVENTS))

  const result = await send(params, { ...quiet, onText: (t) => texts.push(t) })

  expect(texts).toEqual(['Hallo ', 'Anna'])
  expect(result).toMatchObject({ stopReason: 'end_turn', inputTokens: 50, outputTokens: 7, webSearches: 0 })
  expect(result.content).toMatchObject([{ type: 'text', text: 'Hallo Anna' }])
})

test('every finished block is passed on and web searches are counted', async () => {
  const blocks: string[] = []
  const searched = [
    EVENTS[0],
    {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'web_search_tool_result',
        tool_use_id: 'srvtoolu_1',
        content: [{ type: 'web_search_result', url: 'https://acme.de', title: 'Acme', encrypted_content: 'x', page_age: null }],
      },
    },
    { type: 'content_block_stop', index: 0 },
    ...EVENTS.slice(1, 5).map((event) => ('index' in event ? { ...event, index: 1 } : event)),
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 7, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } },
    },
    { type: 'message_stop' },
  ]
  const send = createSendStream(client(searched))

  const result = await send(params, { ...quiet, onBlock: (block) => blocks.push(block.type) })

  expect(blocks).toEqual(['web_search_tool_result', 'text'])
  expect(result.webSearches).toBe(1)
})

test('the stream goes to the messages API without a beta header', async () => {
  const calls: [string, string | null][] = []
  const fetch = (url: unknown, init?: RequestInit): Promise<Response> => {
    calls.push([new URL(String(url)).pathname, new Headers(init?.headers).get('anthropic-beta')])
    return Promise.resolve(new Response('{"type":"error","error":{"type":"overloaded_error","message":"busy"}}', { status: 529 }))
  }
  const send = createSendStream(new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 }))

  await expect(send(params, quiet)).rejects.toThrow()
  expect(calls).toEqual([['/v1/messages', null]])
})

test('a refusal passes on its stop details', async () => {
  const refused = EVENTS.map((event) =>
    event.type === 'message_delta'
      ? {
          type: 'message_delta',
          delta: { stop_reason: 'refusal', stop_sequence: null, stop_details: { type: 'refusal', category: 'cyber', explanation: null } },
          usage: { output_tokens: 7 },
        }
      : event,
  )
  const send = createSendStream(client(refused))

  const result = await send(params, quiet)

  expect(result).toMatchObject({ stopReason: 'refusal', stopDetails: { category: 'cyber' } })
})

test('a stream without a stop reason is an error', async () => {
  const send = createSendStream(client(EVENTS.filter((event) => event.type !== 'message_delta')))

  await expect(send(params, quiet)).rejects.toThrow()
})

test('an aborted stream returns the blocks so far with their citations as stopped', async () => {
  const abort = new AbortController()
  const citation = { type: 'web_search_result_location', url: 'https://acme.de', title: 'Acme', cited_text: 'Acme', encrypted_index: 'x' }
  const cited = [
    EVENTS[0],
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } },
    { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation } },
    EVENTS[2],
    ...EVENTS.slice(3),
  ]
  const send = createSendStream(client(cited, 4))

  const result = await send(params, { ...quiet, onText: () => setTimeout(() => abort.abort(), 10), signal: abort.signal })

  expect(result).toMatchObject({ stopReason: 'stopped', stopDetails: null, inputTokens: 50 })
  expect(result.content).toEqual([{ type: 'text', text: 'Hallo ', citations: [citation] }])
})

test('a failed request is passed on', async () => {
  const fetch = () => Promise.resolve(new Response('{"type":"error","error":{"type":"overloaded_error","message":"busy"}}', { status: 529 }))
  const send = createSendStream(new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 }))

  await expect(send(params, quiet)).rejects.toThrow()
})

const MESSAGE = {
  id: 'msg_2',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [
    { type: 'thinking', thinking: 'Notiz', signature: 'sig' },
    { type: 'text', text: '{"is_job": true}' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  stop_details: null,
  usage: { input_tokens: 900, output_tokens: 300 },
}

function messageClient(message: object, status = 200): Anthropic {
  const fetch = () => Promise.resolve(Response.json(message, { status }))
  return new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 })
}

const extractParams = jobExtractRequest({ kind: 'text', text: 'Anzeige' })

test('a single message returns content, stop reason and tokens', async () => {
  const result = await createSendMessage(messageClient(MESSAGE))(extractParams)

  expect(result).toMatchObject({ stopReason: 'end_turn', stopDetails: null, inputTokens: 900, outputTokens: 300 })
  expect(result.content).toMatchObject([{ type: 'thinking' }, { type: 'text', text: '{"is_job": true}' }])
})

test('a refused message passes on its stop details', async () => {
  const refused = {
    ...MESSAGE,
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category: 'cyber', explanation: null },
  }

  const result = await createSendMessage(messageClient(refused))(extractParams)

  expect(result).toMatchObject({ stopReason: 'refusal', stopDetails: { category: 'cyber' } })
})

test('a message without a stop reason is an error', async () => {
  await expect(createSendMessage(messageClient({ ...MESSAGE, stop_reason: null }))(extractParams)).rejects.toThrow()
})

test('a failed single request is passed on', async () => {
  const failed = { type: 'error', error: { type: 'overloaded_error', message: 'busy' } }

  await expect(createSendMessage(messageClient(failed, 529))(extractParams)).rejects.toThrow()
})
