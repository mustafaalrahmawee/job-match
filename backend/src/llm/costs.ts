import type { Usage } from '@anthropic-ai/sdk/resources/messages'

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type TokenUsage = Pick<
  Usage,
  'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens'
> & { server_tool_use?: Pick<NonNullable<Usage['server_tool_use']>, 'web_search_requests'> | null }

export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
}

export const WEB_SEARCH_USD = 0.01

export function costUsd(model: string, usage: TokenUsage, batch = false): number {
  const price = PRICES[model]
  if (!price) throw new Error(`No price for ${model}`)
  const perMillion =
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
  return (perMillion / 1_000_000) * (batch ? 0.5 : 1) + searches
}
