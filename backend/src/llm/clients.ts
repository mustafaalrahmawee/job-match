import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env.js'

export function createClaudeClient(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL })
}

export function createJudgeClient(): Anthropic {
  return new Anthropic({ apiKey: env.TEST_ANTHROPIC_API_KEY, baseURL: env.EVAL_JUDGE_BASE_URL })
}
