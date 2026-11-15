import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env } from '../config/env.js'

export type Embed = (texts: string[]) => Promise<unknown[]>

export type EmbeddingSettings = { url: string; model: string; digest: string; numCtx: number; timeoutMs: number }

const tagsSchema = z.object({ models: z.array(z.object({ name: z.string(), digest: z.string() })) })

const embedSchema = z.object({ model: z.string().optional(), embeddings: z.array(z.unknown()) })

export function createClaudeClient(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL })
}

export function createEmbeddingClient(settings: EmbeddingSettings, fetchFn: typeof fetch = fetch): Embed {
  const call = async (path: string, signal: AbortSignal, body?: object): Promise<unknown> => {
    const response = await fetchFn(`${settings.url}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
    if (response.ok) return response.json()
    throw new Error(`ollama ${response.status}: ${ollamaError(await response.text())}`)
  }
  return async (texts) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs)
    try {
      const { models } = tagsSchema.parse(await call('/api/tags', controller.signal))
      const model = models.find((entry) => entry.name === settings.model)
      if (!model) throw new Error(`embedding model ${settings.model} missing`)
      if (model.digest !== settings.digest) {
        throw new Error(`embedding model ${settings.model} has digest ${model.digest}, expected ${settings.digest}`)
      }
      const answer = embedSchema.parse(
        await call('/api/embed', controller.signal, {
          model: settings.model,
          input: texts,
          truncate: false,
          options: { num_ctx: settings.numCtx, num_batch: settings.numCtx },
        }),
      )
      if (answer.model !== undefined && answer.model !== settings.model) {
        throw new Error(`embedding model ${answer.model}, expected ${settings.model}`)
      }
      return answer.embeddings
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`embedding timed out after ${settings.timeoutMs} ms`, { cause: error })
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

function ollamaError(text: string): string {
  try {
    return (JSON.parse(text) as { error?: string }).error ?? text
  } catch {
    return text
  }
}
