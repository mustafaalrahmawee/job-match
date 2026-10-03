import { z } from 'zod';

export const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
]);

export const MessageRoleSchema = z.enum(['user', 'assistant']);

export const ModelChoiceSchema = z.enum(['standard', 'advanced']);
export const EffortSchema = z.enum(['low', 'high']);

export const StoredStopReasonSchema = z.enum([
  'end_turn',
  'max_tokens',
  'context_window',
  'aborted',
  'error',
]);

export const MessageSchema = z.object({
  id: z.uuid(),
  role: MessageRoleSchema,
  content: z.array(ContentBlockSchema),
  stopReason: StoredStopReasonSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export const ConversationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ConversationDetailSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});

export const ConversationListSchema = z.array(ConversationSchema);

export const RenameConversationSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

export const MAX_MESSAGE_LENGTH = 8000;

export const ChatRequestSchema = z
  .object({
    conversationId: z.uuid().optional(),
    message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH).optional(),
    model: ModelChoiceSchema,
    effort: EffortSchema,
  })
  .refine((request) => request.message !== undefined || request.conversationId !== undefined, {
    message: 'Ohne Nachricht muss ein Gespräch angegeben sein.',
    path: ['message'],
  });

export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('conversation'), id: z.uuid() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done'), messageId: z.uuid(), truncated: z.boolean() }),
  z.object({ type: z.literal('refusal') }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;
export type Effort = z.infer<typeof EffortSchema>;
export type StoredStopReason = z.infer<typeof StoredStopReasonSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
