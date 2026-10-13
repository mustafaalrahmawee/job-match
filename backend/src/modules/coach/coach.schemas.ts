import { z } from 'zod'

export const conversationIdSchema = z.coerce.number().int().positive()

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(10000),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const messageSchema = z.object({
  id: z.int(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  stop_reason: z.string().nullable(),
  created_at: z.date(),
})

export type MessageOutput = z.infer<typeof messageSchema>

export const conversationSchema = z.object({
  id: z.int(),
  title: z.string(),
  messages: z.array(messageSchema),
})

export type ConversationOutput = z.infer<typeof conversationSchema>
