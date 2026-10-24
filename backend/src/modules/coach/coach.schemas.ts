import { z } from 'zod'

export const conversationIdSchema = z.coerce.number().int().positive()

export const conversationTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export type ConversationTitleInput = z.infer<typeof conversationTitleSchema>

export const chatSettingsSchema = z.object({
  quality: z.enum(['normal', 'extended']),
  effort: z.enum(['medium', 'high']),
})

export type ChatSettingsInput = z.infer<typeof chatSettingsSchema>

export const sendMessageSchema = chatSettingsSchema.extend({
  content: z.string().trim().min(1).max(10000),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const coachStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('application'), application_id: z.int(), title: z.string(), company: z.string().nullable() }),
  z.object({ kind: z.literal('application_failed') }),
  z.object({ kind: z.literal('web_search'), query: z.string(), sources: z.int().nullable() }),
])

export type CoachStep = z.infer<typeof coachStepSchema>

export const messageSchema = z.object({
  id: z.int(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  steps: z.array(coachStepSchema),
  sources: z.array(z.object({ url: z.string(), title: z.string().nullable() })),
  stop_reason: z.string().nullable(),
  created_at: z.date(),
})

export type MessageOutput = z.infer<typeof messageSchema>

export const conversationSummarySchema = z.object({
  id: z.int(),
  title: z.string(),
  updated_at: z.date(),
})

export type ConversationSummaryOutput = z.infer<typeof conversationSummarySchema>

export const conversationSchema = z.object({
  id: z.int(),
  title: z.string(),
  messages: z.array(messageSchema),
})

export type ConversationOutput = z.infer<typeof conversationSchema>
