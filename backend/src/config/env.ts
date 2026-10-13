import { existsSync } from 'node:fs'
import { z } from 'zod'

if (existsSync('.env')) process.loadEnvFile()

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().default(''),
  TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com'),
  TEST_ANTHROPIC_API_KEY: z.string().default(''),
  EVAL_JUDGE_BASE_URL: z.string().default('https://api.z.ai/api/anthropic'),
  EVAL_JUDGE_MODEL: z.string().default('glm-5.3'),
  EVAL_JUDGE_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('max'),
})

export type Env = z.infer<typeof schema>

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error(`Invalid environment:\n${z.prettifyError(parsed.error)}`)
  process.exit(1)
}

export const env: Env = parsed.data
