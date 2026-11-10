import { z } from 'zod'

export const conversationIdSchema = z.coerce.number().int().positive()

export const conversationTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export const chatSettingsSchema = z.object({
  quality: z.enum(['normal', 'extended']),
  effort: z.enum(['medium', 'high']),
})

export const sendMessageSchema = chatSettingsSchema.extend({
  content: z.string().trim().min(1).max(10000),
})

export type CoachStep =
  | { kind: 'application'; application_id: number; title: string; company: string | null }
  | { kind: 'application_failed' }

export type MessageOutput = {
  id: number
  role: 'user' | 'assistant'
  text: string
  steps: CoachStep[]
  stop_reason: string | null
  created_at: Date
}

export type ConversationSummaryOutput = { id: number; title: string; updated_at: Date }

export type ConversationOutput = { id: number; title: string; messages: MessageOutput[] }
