import Anthropic, { APIUserAbortError } from '@anthropic-ai/sdk'
import type {
  ContentBlock,
  Message,
  MessageCreateParamsNonStreaming,
  RefusalStopDetails,
  StopReason,
} from '@anthropic-ai/sdk/resources/messages'

export type StreamHandlers = {
  onText: (text: string) => void
  onBlock: (block: ContentBlock) => void
  signal: AbortSignal
}

export type SendResult = {
  content: ContentBlock[]
  stopReason: StopReason | 'stopped'
  stopDetails: RefusalStopDetails | null
  inputTokens: number
  outputTokens: number
  webSearches: number
}

export type SendStream = (params: MessageCreateParamsNonStreaming, handlers: StreamHandlers) => Promise<SendResult>

export type SendMessage = (params: MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }) => Promise<SendResult>

function result(message: Message): SendResult {
  if (!message.stop_reason) throw new Error('The message ended without a stop reason')
  return {
    content: message.content,
    stopReason: message.stop_reason,
    stopDetails: message.stop_details,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    webSearches: message.usage.server_tool_use?.web_search_requests ?? 0,
  }
}

export function createSendMessage(client: Anthropic): SendMessage {
  return async (params, options) => result(await client.messages.create(params, options))
}

export function createSendStream(client: Anthropic): SendStream {
  return async (params, { onText, onBlock, signal }) => {
    const stream = client.messages.stream(params, { signal })
    stream.on('text', (delta) => onText(delta))
    stream.on('contentBlock', (block) => onBlock(block))
    try {
      return result(await stream.finalMessage())
    } catch (error) {
      if (!(error instanceof APIUserAbortError)) throw error
      const partial = stream.currentMessage
      return {
        content: partial?.content ?? [],
        stopReason: 'stopped',
        stopDetails: null,
        inputTokens: partial?.usage.input_tokens ?? 0,
        outputTokens: partial?.usage.output_tokens ?? 0,
        webSearches: partial?.usage.server_tool_use?.web_search_requests ?? 0,
      }
    }
  }
}
