import type Anthropic from '@anthropic-ai/sdk'
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { env } from '../src/config/env.js'
import { createClaudeClient } from '../src/llm/clients.js'

export type BatchRequest = { custom_id: string; params: MessageCreateParamsNonStreaming }

export type BatchOutcome = { results: Map<string, Message | string>; latencySeconds: number }

const ANTHROPIC_URL = 'https://api.anthropic.com'
const POLL_MS = 30_000

export function claudeForBatches(): Anthropic {
  if (env.ANTHROPIC_BASE_URL.replace(/\/+$/, '') !== ANTHROPIC_URL) {
    throw new Error(`Batches need ${ANTHROPIC_URL}, ANTHROPIC_BASE_URL is ${env.ANTHROPIC_BASE_URL}`)
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is missing in backend/.env')
  return createClaudeClient()
}

export async function createBatch(requests: BatchRequest[]): Promise<string> {
  const batch = await claudeForBatches().messages.batches.create({ requests })
  return batch.id
}

export async function collectBatch(id: string): Promise<BatchOutcome> {
  const client = claudeForBatches()
  let batch = await client.messages.batches.retrieve(id)
  while (batch.processing_status !== 'ended') {
    console.log(`Batch ${id}: ${batch.request_counts.processing} requests still processing ...`)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    batch = await client.messages.batches.retrieve(id)
  }
  const results = new Map<string, Message | string>()
  for await (const item of await client.messages.batches.results(id)) {
    results.set(item.custom_id, item.result.type === 'succeeded' ? item.result.message : item.result.type)
  }
  const ended = batch.ended_at ? Date.parse(batch.ended_at) : Date.now()
  return { results, latencySeconds: Math.round((ended - Date.parse(batch.created_at)) / 1000) }
}
