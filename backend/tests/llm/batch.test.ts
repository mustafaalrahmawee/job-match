import Anthropic from '@anthropic-ai/sdk'
import { expect, test } from 'vitest'
import { createBatches } from '../../src/llm/batch.js'

const RESULTS_URL = 'https://api.anthropic.com/v1/messages/batches/msgbatch_1/results'

function client(status: 'in_progress' | 'ended', lines: object[]): Anthropic {
  const fetch = (url: unknown): Promise<Response> => {
    if (String(url) === RESULTS_URL) {
      const body = lines.map((line) => JSON.stringify(line)).join('\n')
      return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/binary' } }))
    }
    const batch = {
      id: 'msgbatch_1',
      type: 'message_batch',
      processing_status: status,
      request_counts: { processing: 0, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
      created_at: '2026-10-15T10:00:00Z',
      ended_at: status === 'ended' ? '2026-10-15T10:01:00Z' : null,
      expires_at: '2026-10-16T10:00:00Z',
      archived_at: null,
      cancel_initiated_at: null,
      results_url: status === 'ended' ? RESULTS_URL : null,
    }
    return Promise.resolve(new Response(JSON.stringify(batch), { headers: { 'Content-Type': 'application/json' } }))
  }
  return new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 })
}

test('a batch still processing has no result', async () => {
  const batches = createBatches(client('in_progress', []))

  expect(await batches.result('msgbatch_1', 'cv-1')).toBeNull()
})

test('the result is picked by its custom id', async () => {
  const batches = createBatches(
    client('ended', [
      { custom_id: 'cv-2', result: { type: 'canceled' } },
      { custom_id: 'cv-1', result: { type: 'errored', error: { type: 'error', error: { type: 'api_error', message: 'x' } } } },
    ]),
  )

  expect(await batches.result('msgbatch_1', 'cv-1')).toMatchObject({ type: 'errored' })
})

test('an ended batch without the custom id counts as expired', async () => {
  const batches = createBatches(client('ended', [{ custom_id: 'cv-2', result: { type: 'canceled' } }]))

  expect(await batches.result('msgbatch_1', 'cv-1')).toEqual({ type: 'expired' })
})
