import { expect, test } from 'vitest'
import { costUsd } from '../../src/llm/costs.js'
import { coachChatRequest } from '../../src/prompts/coach_chat.js'

const USAGE = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

test('Haiku costs input plus output, half of it in a batch', () => {
  expect(costUsd('claude-haiku-5-5', USAGE)).toBeCloseTo(0.6)
  expect(costUsd('claude-haiku-5-5', USAGE, true)).toBeCloseTo(0.3)
})

test('a model without a price fails loudly', () => {
  expect(() => costUsd('claude-fable-5-1', USAGE)).toThrow('No price')
})

test('the eval variant overrides model, effort and quality of the coach request', () => {
  const messages = [{ role: 'user' as const, content: 'Hallo' }]
  const settings = { quality: 'normal', effort: 'high' } as const
  const request = coachChatRequest(messages, settings, { model: 'claude-haiku-5-5', effort: 'low', quality: 'extended' })
  expect(request.model).toBe('claude-haiku-5-5')
  expect(request).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'low' } })
  expect(coachChatRequest(messages, settings)).toMatchObject({
    model: 'claude-sonnet-5-5',
    thinking: { type: 'between_tools' },
    output_config: { effort: 'high' },
  })
})
