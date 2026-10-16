import type Anthropic from '@anthropic-ai/sdk'
import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches'
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'

export type Batches = {
  submit(customId: string, params: MessageCreateParamsNonStreaming): Promise<string>
  result(batchId: string, customId: string): Promise<MessageBatchResult | null>
}

export function createBatches(client: Anthropic): Batches {
  return {
    async submit(customId, params) {
      const batch = await client.messages.batches.create({ requests: [{ custom_id: customId, params }] })
      return batch.id
    },
    async result(batchId, customId) {
      const batch = await client.messages.batches.retrieve(batchId)
      if (batch.processing_status !== 'ended') return null
      for await (const item of await client.messages.batches.results(batchId)) {
        if (item.custom_id === customId) return item.result
      }
      return { type: 'expired' }
    },
  }
}
