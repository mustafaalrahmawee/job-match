import Anthropic from '@anthropic-ai/sdk'
import { expect, test } from 'vitest'
import { createSendMessage, createSendStream } from '../../src/llm/send.js'
import { coachChatRequest } from '../../src/prompts/coach_chat.js'
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

const params = coachChatRequest([{ role: 'user', content: 'Hallo' }], { quality: 'normal', effort: 'medium' }, null)

test('a finished stream returns content, stop reason and tokens', async () => {
  const texts: string[] = []
  const send = createSendStream(client(EVENTS))

  const result = await send(params, { onText: (t) => texts.push(t), signal: new AbortController().signal })

  expect(texts).toEqual(['Hallo ', 'Anna'])
  expect(result).toMatchObject({ stopReason: 'end_turn', inputTokens: 50, outputTokens: 7 })
  expect(result.content).toMatchObject([{ type: 'text', text: 'Hallo Anna' }])
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

  const result = await send(params, { onText: () => undefined, signal: new AbortController().signal })

  expect(result).toMatchObject({ stopReason: 'refusal', stopDetails: { category: 'cyber' } })
})

test('a stream without a stop reason is an error', async () => {
  const send = createSendStream(client(EVENTS.filter((event) => event.type !== 'message_delta')))

  await expect(send(params, { onText: () => undefined, signal: new AbortController().signal })).rejects.toThrow()
})

test('an aborted stream returns the text so far as stopped', async () => {
  const abort = new AbortController()
  const send = createSendStream(client(EVENTS, 3))

  const result = await send(params, { onText: () => setTimeout(() => abort.abort(), 10), signal: abort.signal })

  expect(result).toMatchObject({ stopReason: 'stopped', stopDetails: null, inputTokens: 50 })
  expect(result.content).toEqual([{ type: 'text', text: 'Hallo ', citations: null }])
})

test('a failed request is passed on', async () => {
  const fetch = () => Promise.resolve(new Response('{"type":"error","error":{"type":"overloaded_error","message":"busy"}}', { status: 529 }))
  const send = createSendStream(new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 }))

  await expect(send(params, { onText: () => undefined, signal: new AbortController().signal })).rejects.toThrow()
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
