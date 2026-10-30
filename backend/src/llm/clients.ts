import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env.js'

export function createClaudeClient(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL })
}
