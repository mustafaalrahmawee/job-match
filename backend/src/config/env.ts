import { existsSync } from 'node:fs'
import { z } from 'zod'

if (existsSync('.env')) process.loadEnvFile()

const serviceUrl = z
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1')
  }, 'http:// is only allowed for 127.0.0.1, otherwise https://')

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().default(''),
  TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com'),
  CHROMA_URL: serviceUrl.default('http://127.0.0.1:8001'),
  TEST_CHROMA_URL: z.union([z.literal(''), serviceUrl]).default(''),
  OLLAMA_URL: serviceUrl.default('http://127.0.0.1:11434'),
  EVAL_JUDGE_MODEL: z.string().default('gpt-6.1-sol'),
  EVAL_JUDGE_EFFORT: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).default('high'),
})

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error(`Invalid environment:\n${z.prettifyError(parsed.error)}`)
  process.exit(1)
}

export const env: Env = parsed.data
