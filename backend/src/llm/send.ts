import Anthropic, { APIUserAbortError } from '@anthropic-ai/sdk'
import type {
  ContentBlock,
  MessageCreateParamsBase,
  MessageCreateParamsNonStreaming,
  RefusalStopDetails,
  StopReason,
} from '@anthropic-ai/sdk/resources/messages'

export type StreamHandlers = { onText: (text: string) => void; signal: AbortSignal }

export type SendResult = {
  content: ContentBlock[]
  stopReason: StopReason | 'stopped'
  stopDetails: RefusalStopDetails | null
  inputTokens: number
  outputTokens: number
}

export type SendStream = (params: MessageCreateParamsBase, handlers: StreamHandlers) => Promise<SendResult>

export type SendMessage = (params: MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }) => Promise<SendResult>

export function createSendMessage(client: Anthropic): SendMessage {
  return async (params, options) => {
    const message = await client.messages.create(params, options)
    if (!message.stop_reason) throw new Error('The message ended without a stop reason')
    return {
      content: message.content,
      stopReason: message.stop_reason,
      stopDetails: message.stop_details,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }
  }
}

export function createSendStream(client: Anthropic): SendStream {
  return async (params, { onText, signal }) => {
    const stream = client.messages.stream(params, { signal })
    stream.on('text', (delta) => onText(delta))
    try {
      const message = await stream.finalMessage()
      if (!message.stop_reason) throw new Error('The stream ended without a stop reason')
      return {
        content: message.content,
        stopReason: message.stop_reason,
        stopDetails: message.stop_details,
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
        stopDetails: null,
        inputTokens: partial?.usage.input_tokens ?? 0,
        outputTokens: partial?.usage.output_tokens ?? 0,
      }
    }
  }
}
