import Anthropic, { APIUserAbortError } from '@anthropic-ai/sdk'
import type { ContentBlock, MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'

export type StreamHandlers = { onText: (text: string) => void; signal: AbortSignal }

export type StreamResult = {
  content: ContentBlock[]
  stopReason: string
  inputTokens: number
  outputTokens: number
}

export type SendStream = (params: MessageCreateParamsBase, handlers: StreamHandlers) => Promise<StreamResult>

export function createSendStream(client: Anthropic): SendStream {
  return async (params, { onText, signal }) => {
    const stream = client.messages.stream(params, { signal })
    stream.on('text', (delta) => onText(delta))
    try {
      const message = await stream.finalMessage()
      return {
        content: message.content,
        stopReason: message.stop_reason ?? 'end_turn',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      }
    } catch (error) {
      if (!(error instanceof APIUserAbortError)) throw error
      const partial = stream.currentMessage
      const text = (partial?.content ?? [])
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
      return {
        content: text ? [{ type: 'text', text, citations: null }] : [],
        stopReason: 'stopped',
        inputTokens: partial?.usage.input_tokens ?? 0,
        outputTokens: partial?.usage.output_tokens ?? 0,
      }
    }
  }
}
